// ============================================
// Content Script: Facebook Marketplace Filler
// Runs on facebook.com/marketplace/create/*
// ============================================

(function () {
  "use strict";

  const MAX_WAIT = 60; // retries
  const WAIT_MS = 500;

  let hasRun = false;

  init();

  async function init() {
    if (hasRun) return;
    hasRun = true;

    log("Initializing on", window.location.href);

    const data = await getStorage("scrapedPart");
    if (!data) {
      log("No scraped data found. Skipping.");
      return;
    }

    log("Data loaded:", data.title);
    showOverlay(data);

    // Wait for the listing type selection if present, then wait for form
    await waitForFormAndFill(data);
  }

  // ============================================
  // Storage
  // ============================================

  function getStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (r) => resolve(r[key] || null));
    });
  }

  // ============================================
  // Main fill logic
  // ============================================

  async function waitForFormAndFill(data) {
    // First, check if we need to select "Item for Sale" listing type
    await selectListingType();

    // Now wait for the actual form
    let retries = 0;
    while (retries < MAX_WAIT) {
      retries++;

      // Try multiple known selectors for the title field
      const titleInput = findField("Title") || findField("What are you selling?");
      if (titleInput) {
        log("Form found! Filling...");
        await fillForm(data, titleInput);
        return;
      }

      await sleep(WAIT_MS);
    }

    updateOverlay("⚠️ Form not found after waiting. Try refreshing the page.");
  }

  async function selectListingType() {
    // FB might show a selection screen: "Item for Sale", "Vehicle", "Home for Sale/Rent"
    // Wait a bit for it to appear
    await sleep(2000);

    const selectors = [
      // Try to find "Item for Sale" or similar text
      () => findClickableByText("Item for sale"),
      () => findClickableByText("Item for Sale"),
      () => findClickableByText("Items for sale"),
      () => findClickableByText("Miscellaneous"),
      // aria-label approach
      () => document.querySelector('[aria-label="Item for sale"]'),
      () => document.querySelector('[aria-label="Item for Sale"]'),
    ];

    for (const selector of selectors) {
      const el = selector();
      if (el) {
        log("Clicking listing type:", el.textContent?.trim());
        el.click();
        await sleep(1500);
        return;
      }
    }

    log("No listing type selection found — may already be on item form");
  }

  async function fillForm(data, titleInput) {
    // 1. Upload photos FIRST (FB expects photos before other fields sometimes)
    if (data.photos && data.photos.length > 0) {
      updateOverlay("📷 Uploading photos...");
      await uploadPhotos(data.photos);
      await sleep(1000);
    }

    // 2. Fill Title
    updateOverlay("✏️ Filling title...");
    await setInputValue(titleInput, data.title || "");
    await sleep(400);

    // 3. Fill Price
    const priceInput = findField("Price");
    if (priceInput) {
      const price = data.price ? Math.round(parseFloat(data.price)).toString() : "0";
      await setInputValue(priceInput, price);
      await sleep(400);
    }

    // 4. Try to expand "More details"
    await clickByText("More details");
    await sleep(600);

    // 5. Fill Description
    const descInput = findField("Description") || findField("Describe your item");
    if (descInput) {
      let desc = data.description || "";
      if (data.make || data.model || data.year) {
        const vehicle = [data.year, data.make, data.model].filter(Boolean).join(" ");
        desc = `🚗 ${vehicle}\n\n${desc}`;
      }
      if (data.vin) desc += `\n\nVIN: ${data.vin}`;
      if (data.serial_number) desc += `\nS/N: ${data.serial_number}`;
      await setInputValue(descInput, desc);
      await sleep(400);
    }

    // 6. Set Condition
    await setCondition(data.condition);
    await sleep(400);

    // 7. Open Category for manual selection
    await clickByText("Category");

    updateOverlay("✅ Done! Select category manually if needed.");
    log("Form filling complete!");
  }

  // ============================================
  // Photo Upload via hidden file input
  // ============================================

  async function uploadPhotos(photoUrls) {
    // Find the file input — FB hides it but it exists
    const fileInputs = document.querySelectorAll('input[type="file"]');
    let fileInput = null;

    for (const input of fileInputs) {
      if (input.accept && input.accept.includes("image")) {
        fileInput = input;
        break;
      }
    }

    // Fallback: any file input
    if (!fileInput && fileInputs.length > 0) {
      fileInput = fileInputs[0];
    }

    if (!fileInput) {
      // Try clicking the "Add photos" area to make the input appear
      const addPhotoBtn =
        findClickableByText("Add photos") ||
        findClickableByText("Add Photos") ||
        document.querySelector('[aria-label="Add photos"]') ||
        document.querySelector('[aria-label="Add Photos"]');

      if (addPhotoBtn) {
        addPhotoBtn.click();
        await sleep(1000);
      }

      // Try again
      const inputs = document.querySelectorAll('input[type="file"]');
      for (const input of inputs) {
        fileInput = input;
        break;
      }
    }

    if (!fileInput) {
      log("No file input found for photos");
      updateOverlay("⚠️ Could not find photo upload. Add photos manually.");
      return;
    }

    log("File input found, fetching", photoUrls.length, "images...");

    // Fetch all images as blobs and create File objects
    const files = [];
    for (let i = 0; i < photoUrls.length; i++) {
      try {
        const resp = await fetch(photoUrls[i]);
        const blob = await resp.blob();
        const ext = blob.type.split("/")[1] || "jpg";
        const file = new File([blob], `photo_${i + 1}.${ext}`, {
          type: blob.type,
        });
        files.push(file);
        log(`Fetched image ${i + 1}/${photoUrls.length}`);
      } catch (err) {
        log(`Failed to fetch image ${i + 1}:`, err.message);
      }
    }

    if (files.length === 0) {
      log("No images fetched successfully");
      return;
    }

    // Create DataTransfer and assign files
    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));

    // Set files on the input
    fileInput.files = dataTransfer.files;

    // Dispatch events to trigger React
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));

    log(`Uploaded ${files.length} photos via file input`);
    updateOverlay(`📷 ${files.length} photos uploaded!`);
    await sleep(1000);

    // Also try drag-and-drop as a fallback
    await tryDragDrop(files);
  }

  async function tryDragDrop(files) {
    // Find the drop zone (usually the photo area)
    const dropZone =
      document.querySelector('[aria-label="Add photos"]') ||
      document.querySelector('[aria-label="Add Photos"]') ||
      findClickableByText("Add photos")?.closest("div") ||
      document.querySelector('[role="button"][tabindex="0"]');

    if (!dropZone) return;

    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));

    const events = ["dragenter", "dragover", "drop"];
    for (const eventType of events) {
      const event = new DragEvent(eventType, {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      dropZone.dispatchEvent(event);
      await sleep(100);
    }

    log("Drag-and-drop events dispatched");
  }

  // ============================================
  // React input filling
  // ============================================

  async function setInputValue(el, value) {
    if (!el) return;

    el.focus();
    el.click();
    await sleep(80);

    // contentEditable
    if (el.getAttribute("contenteditable") === "true" || el.isContentEditable) {
      el.textContent = "";
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    // Regular input / textarea
    const proto =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    const prev = el.value;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }

    // React value tracker trick
    const tracker = el._valueTracker;
    if (tracker) {
      tracker.setValue(prev);
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));

    await sleep(80);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ============================================
  // Condition dropdown
  // ============================================

  const CONDITION_MAP = {
    new: "New",
    like_new: "Used - Like New",
    excellent: "Used - Good",
    good: "Used - Good",
    fair: "Used - Fair",
    used: "Used - Fair",
    for_parts: "Used - Fair",
  };

  async function setCondition(condition) {
    const target = CONDITION_MAP[condition] || "Used - Good";

    // Find condition dropdown
    const btn =
      document.querySelector('[aria-label="Condition"]') ||
      findClickableByText("Condition");

    if (!btn) {
      log("Condition dropdown not found");
      return;
    }

    btn.click();
    await sleep(600);

    // Find the matching option
    const options = document.querySelectorAll(
      '[role="option"], [role="menuitem"], [role="listbox"] [role="option"]'
    );

    for (const opt of options) {
      const text = opt.textContent.trim();
      if (text === target || text.includes(target.split(" - ").pop())) {
        opt.click();
        log("Condition set:", text);
        return;
      }
    }

    // Broader search
    for (const span of document.querySelectorAll("span")) {
      const text = span.textContent.trim();
      if (text === target) {
        span.click();
        log("Condition set (span):", text);
        return;
      }
    }

    log("Could not select condition:", target);
  }

  // ============================================
  // DOM helpers — NO obfuscated class selectors
  // ============================================

  function findField(label) {
    return (
      document.querySelector(`input[aria-label="${label}"]`) ||
      document.querySelector(`textarea[aria-label="${label}"]`) ||
      document.querySelector(`[aria-label="${label}"][contenteditable]`) ||
      document.querySelector(`input[placeholder*="${label}"]`) ||
      document.querySelector(`textarea[placeholder*="${label}"]`) ||
      document.querySelector(`[aria-label="${label}"] input`) ||
      document.querySelector(`[aria-label="${label}"] textarea`)
    );
  }

  function findClickableByText(text) {
    // Search spans, labels, divs for exact or partial text
    const candidates = document.querySelectorAll(
      'span, [role="button"], label, a'
    );
    for (const el of candidates) {
      // Only match direct text, not children's text
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join("");

      if (directText && directText.toLowerCase() === text.toLowerCase()) {
        return el;
      }
    }
    // Fallback: includes match
    for (const el of candidates) {
      if (
        el.textContent.trim().toLowerCase() === text.toLowerCase() &&
        el.children.length === 0
      ) {
        return el;
      }
    }
    return null;
  }

  async function clickByText(text) {
    const el = findClickableByText(text);
    if (el) {
      const clickTarget = el.closest('[role="button"]') || el;
      clickTarget.click();
      log("Clicked:", text);
    }
  }

  // ============================================
  // Overlay
  // ============================================

  function showOverlay(data) {
    const existing = document.getElementById("parts-fb-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "parts-fb-overlay";
    overlay.innerHTML = `
      <div class="pfb-header">
        <span>🔧 Auto Parts Filler</span>
        <button id="pfb-close">✕</button>
      </div>
      <div class="pfb-body">
        <div class="pfb-status" id="pfb-status">⏳ Loading form...</div>
        <div class="pfb-info">
          <strong>${esc(data.title)}</strong><br/>
          $${parseFloat(data.price || 0).toFixed(2)}
          ${data.photos?.length ? ` · ${data.photos.length} photo(s)` : ""}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("pfb-close").addEventListener("click", () => {
      overlay.remove();
    });

    setTimeout(() => {
      if (overlay.parentElement) overlay.remove();
    }, 60000);
  }

  function updateOverlay(msg) {
    const el = document.getElementById("pfb-status");
    if (el) el.textContent = msg;
  }

  function esc(t) {
    const d = document.createElement("div");
    d.textContent = t || "";
    return d.innerHTML;
  }

  // ============================================
  // Utilities
  // ============================================

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function log(...args) {
    console.log("[FB Filler]", ...args);
  }
})();
