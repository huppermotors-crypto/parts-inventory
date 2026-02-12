// ============================================
// Content Script: Facebook Marketplace Filler
// Runs on facebook.com/marketplace/create/*
// ============================================

(function () {
  "use strict";

  const MAX_RETRIES = 120; // 120 * 500ms = 60 seconds max wait
  const RETRY_MS = 500;

  let hasRun = false;

  // FB is a SPA — the page may not be ready yet. Wait for load then init.
  if (document.readyState === "complete") {
    startWithDelay();
  } else {
    window.addEventListener("load", startWithDelay);
  }

  function startWithDelay() {
    // Give FB extra time to render its React app after page load
    setTimeout(init, 3000);
  }

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
    // Step 1: Wait for and select listing type
    updateOverlay("⏳ Waiting for FB to load...");
    await selectListingType();

    // Step 2: Wait for form fields to appear
    updateOverlay("⏳ Waiting for form...");
    let retries = 0;
    while (retries < MAX_RETRIES) {
      retries++;

      const titleInput =
        findField("Title") ||
        findField("What are you selling?") ||
        findField("Listing title");
      if (titleInput) {
        log("Form found after", retries, "retries. Filling...");
        await sleep(500); // brief pause for other fields to render
        await fillForm(data, titleInput);
        return;
      }

      await sleep(RETRY_MS);
    }

    updateOverlay("⚠️ Form not found after 60s. Try refreshing the page.");
  }

  async function selectListingType() {
    // FB might show a selection screen: "Item for Sale", "Vehicle", etc.
    // Use retry loop instead of fixed wait
    let retries = 0;
    const maxRetries = 20; // 20 * 500ms = 10 seconds

    while (retries < maxRetries) {
      retries++;

      const el =
        findClickableByText("Item for sale") ||
        findClickableByText("Item for Sale") ||
        findClickableByText("Items for sale") ||
        findClickableByText("Miscellaneous") ||
        document.querySelector('[aria-label="Item for sale"]') ||
        document.querySelector('[aria-label="Item for Sale"]');

      if (el) {
        log("Clicking listing type:", el.textContent?.trim());
        el.click();
        await sleep(2000); // wait for form to load after selection
        return;
      }

      // Check if form is already showing (no listing type selection needed)
      const titleInput =
        findField("Title") ||
        findField("What are you selling?") ||
        findField("Listing title");
      if (titleInput) {
        log("Form already visible — no listing type selection needed");
        return;
      }

      await sleep(500);
    }

    log("No listing type selection found after waiting — proceeding anyway");
  }

  async function fillForm(data, titleInput) {
    // 1. Upload photos FIRST
    if (data.photos && data.photos.length > 0) {
      updateOverlay("📷 Uploading photos...");
      await uploadPhotos(data.photos);
      await sleep(2000); // wait for FB to process uploads
    }

    // 2. Fill Title
    updateOverlay("✏️ Filling title...");
    await setInputValue(titleInput, data.title || "");
    await sleep(600);

    // 3. Fill Price
    const priceInput = findField("Price");
    if (priceInput) {
      const price = data.price
        ? Math.round(parseFloat(data.price)).toString()
        : "0";
      await setInputValue(priceInput, price);
      await sleep(600);
    }

    // 4. Set Condition (do before expanding "More details")
    updateOverlay("✏️ Setting condition...");
    await setCondition(data.condition);
    await sleep(600);

    // 5. Try to expand "More details"
    await clickByText("More details");
    await sleep(1000);

    // 6. Fill Description
    updateOverlay("✏️ Filling description...");
    const descInput =
      findField("Description") ||
      findField("Describe your item") ||
      findField("Add a description");
    if (descInput) {
      let desc = data.description || "";
      if (data.make || data.model || data.year) {
        const vehicle = [data.year, data.make, data.model]
          .filter(Boolean)
          .join(" ");
        desc = `${vehicle}\n\n${desc}`;
      }
      if (data.vin) desc += `\n\nVIN: ${data.vin}`;
      if (data.serial_number) desc += `\nS/N: ${data.serial_number}`;
      await setInputValue(descInput, desc.trim());
      await sleep(600);
    }

    // 7. Set category to "Car Parts & Accessories"
    updateOverlay("✏️ Setting category...");
    await setCategory();
    await sleep(600);

    // 8. Clear stored data so it doesn't auto-fill next time
    chrome.storage.local.remove("scrapedPart");

    updateOverlay("✅ Done! Review and publish your listing.");
    log("Form filling complete!");
  }

  // ============================================
  // Photo Upload
  // ============================================

  async function uploadPhotos(photoUrls) {
    // Find or trigger the file input
    let fileInput = findFileInput();

    if (!fileInput) {
      // Try clicking the "Add photos" area to make the input appear
      const addPhotoBtn =
        findClickableByText("Add photos") ||
        findClickableByText("Add Photos") ||
        document.querySelector('[aria-label="Add photos"]') ||
        document.querySelector('[aria-label="Add Photos"]');

      if (addPhotoBtn) {
        addPhotoBtn.click();
        await sleep(1500);
      }

      fileInput = findFileInput();
    }

    if (!fileInput) {
      log("No file input found for photos");
      updateOverlay("⚠️ Could not find photo upload. Add photos manually.");
      return;
    }

    log("File input found, fetching", photoUrls.length, "images...");

    // Fetch images via background script to avoid CORS issues
    const files = [];
    for (let i = 0; i < photoUrls.length; i++) {
      try {
        updateOverlay(
          `📷 Downloading image ${i + 1}/${photoUrls.length}...`
        );
        const blob = await fetchImageViaBackground(photoUrls[i]);
        if (blob) {
          const ext = blob.type.split("/")[1] || "jpg";
          const file = new File([blob], `photo_${i + 1}.${ext}`, {
            type: blob.type,
          });
          files.push(file);
          log(`Fetched image ${i + 1}/${photoUrls.length}`);
        }
      } catch (err) {
        log(`Failed to fetch image ${i + 1}:`, err.message);
        // Fallback: try direct fetch (might work if same-origin or CORS allowed)
        try {
          const resp = await fetch(photoUrls[i]);
          const blob = await resp.blob();
          const ext = blob.type.split("/")[1] || "jpg";
          const file = new File([blob], `photo_${i + 1}.${ext}`, {
            type: blob.type,
          });
          files.push(file);
          log(`Fetched image ${i + 1} via direct fetch`);
        } catch (e) {
          log(`Direct fetch also failed for image ${i + 1}:`, e.message);
        }
      }
    }

    if (files.length === 0) {
      log("No images fetched successfully");
      updateOverlay("⚠️ Could not download photos. Add them manually.");
      return;
    }

    // Create DataTransfer and assign files
    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));

    // Set files on the input and trigger events
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));

    log(`Set ${files.length} photos on file input`);
    updateOverlay(`📷 ${files.length} photo(s) uploading...`);

    await sleep(1500);

    // Also try drag-and-drop as fallback
    await tryDragDrop(files);
  }

  function findFileInput() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Prefer the one that accepts images
    for (const input of fileInputs) {
      if (input.accept && input.accept.includes("image")) {
        return input;
      }
    }
    // Fallback: any file input
    return fileInputs.length > 0 ? fileInputs[0] : null;
  }

  function fetchImageViaBackground(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "FETCH_IMAGE", url },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.data) {
            // Convert base64 back to blob
            const binary = atob(response.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            resolve(new Blob([bytes], { type: response.type || "image/jpeg" }));
          } else {
            reject(new Error("No image data returned"));
          }
        }
      );
    });
  }

  async function tryDragDrop(files) {
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
      await sleep(150);
    }

    log("Drag-and-drop events dispatched");
  }

  // ============================================
  // React-compatible input filling
  // ============================================

  async function setInputValue(el, value) {
    if (!el) return;

    el.focus();
    await sleep(100);
    el.click();
    await sleep(100);

    // contentEditable elements (FB uses these for some fields)
    if (el.getAttribute("contenteditable") === "true" || el.isContentEditable) {
      // Clear existing content
      el.textContent = "";
      el.innerHTML = "";
      el.focus();
      await sleep(50);

      // Use execCommand for React compatibility
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await sleep(50);

      // Insert text character by character for short values,
      // or all at once for long values
      if (value.length <= 100) {
        document.execCommand("insertText", false, value);
      } else {
        // For long text, insert in chunks to avoid issues
        const chunks = value.match(/.{1,50}/gs) || [value];
        for (const chunk of chunks) {
          document.execCommand("insertText", false, chunk);
          await sleep(30);
        }
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(100);
      return;
    }

    // Regular input / textarea — use native setter to bypass React
    const proto =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    // Save previous value for React's value tracker
    const prev = el.value;

    // Set value via native setter
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }

    // Reset React's internal value tracker so it detects the change
    const tracker = el._valueTracker;
    if (tracker) {
      tracker.setValue(prev);
    }

    // Dispatch events that React listens to
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Also fire keyboard events for extra React compatibility
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true })
    );
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));

    await sleep(100);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    await sleep(100);

    // Verify the value was set
    if (el.value !== value) {
      log("Value mismatch, retrying with fallback...");
      el.focus();
      await sleep(50);
      // Try selecting all and typing
      el.select?.();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // ============================================
  // Condition dropdown
  // ============================================

  const CONDITION_MAP = {
    new: "New",
    like_new: "Used - Like New",
    excellent: "Used - Good",
    good: "Used - Good",
    fair: "Used - Good",
    used: "Used - Good",
    for_parts: "Used - Good",
  };

  async function setCondition(condition) {
    const target = CONDITION_MAP[condition] || "Used - Good";

    // Find condition dropdown — try multiple approaches
    const btn =
      document.querySelector('[aria-label="Condition"]') ||
      findClickableByText("Condition") ||
      findClickableByText("Select condition");

    if (!btn) {
      log("Condition dropdown not found");
      return;
    }

    btn.click();
    await sleep(1000); // FB dropdown animation

    // Wait for options to appear
    let options = null;
    for (let i = 0; i < 10; i++) {
      options = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="listbox"] [role="option"]'
      );
      if (options.length > 0) break;
      await sleep(300);
    }

    if (!options || options.length === 0) {
      // Try broader search
      options = document.querySelectorAll("[role='listbox'] > *");
    }

    // Find matching option
    for (const opt of options || []) {
      const text = opt.textContent.trim();
      if (text === target || text.includes(target.split(" - ").pop())) {
        opt.click();
        log("Condition set:", text);
        return;
      }
    }

    // Broader: search all spans
    for (const span of document.querySelectorAll("span")) {
      const text = span.textContent.trim();
      if (text === target) {
        const clickTarget =
          span.closest("[role='option']") ||
          span.closest("[role='menuitem']") ||
          span;
        clickTarget.click();
        log("Condition set (span):", text);
        return;
      }
    }

    log("Could not select condition:", target);
  }

  // ============================================
  // Category selection
  // ============================================

  async function setCategory() {
    const TARGET_CATEGORY = "Car Parts & Accessories";

    // Find and click the category field
    const btn =
      document.querySelector('[aria-label="Category"]') ||
      findClickableByText("Category") ||
      findClickableByText("Select category");

    if (!btn) {
      log("Category button not found");
      return;
    }

    btn.click();
    await sleep(1000);

    // Wait for category options/search to appear
    for (let i = 0; i < 10; i++) {
      // Try to find a search input inside the category dialog
      const searchInput =
        document.querySelector('[aria-label="Search categories"]') ||
        document.querySelector('[aria-label="Search"]') ||
        document.querySelector('[placeholder*="Search"]') ||
        document.querySelector('[role="dialog"] input[type="search"]') ||
        document.querySelector('[role="dialog"] input[type="text"]');

      if (searchInput) {
        // Type category name to filter
        await setInputValue(searchInput, "Car Parts");
        await sleep(1500);

        // Click matching option
        const option =
          findClickableByText(TARGET_CATEGORY) ||
          findClickableByText("Car Parts");
        if (option) {
          option.click();
          log("Category set:", TARGET_CATEGORY);
          return;
        }
      }

      // No search input — try direct option list
      const options = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [role="listbox"] [role="option"]'
      );
      for (const opt of options) {
        if (opt.textContent.trim().includes("Car Parts")) {
          opt.click();
          log("Category set (direct):", opt.textContent.trim());
          return;
        }
      }

      // Also try clicking any span that matches
      for (const span of document.querySelectorAll("span")) {
        const text = span.textContent.trim();
        if (text === TARGET_CATEGORY || text === "Car Parts & Accessories") {
          const clickTarget =
            span.closest("[role='option']") ||
            span.closest("[role='menuitem']") ||
            span.closest("[role='button']") ||
            span;
          clickTarget.click();
          log("Category set (span):", text);
          return;
        }
      }

      await sleep(500);
    }

    log("Could not select category:", TARGET_CATEGORY);
  }

  // ============================================
  // DOM helpers
  // ============================================

  function findField(label) {
    return (
      document.querySelector(`input[aria-label="${label}"]`) ||
      document.querySelector(`textarea[aria-label="${label}"]`) ||
      document.querySelector(
        `[aria-label="${label}"][contenteditable="true"]`
      ) ||
      document.querySelector(`input[placeholder*="${label}"]`) ||
      document.querySelector(`textarea[placeholder*="${label}"]`) ||
      document.querySelector(`[aria-label="${label}"] input`) ||
      document.querySelector(`[aria-label="${label}"] textarea`) ||
      // Also search by label text
      findInputByLabelText(label)
    );
  }

  function findInputByLabelText(text) {
    const labels = document.querySelectorAll("label");
    for (const label of labels) {
      if (label.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
        const input =
          label.querySelector("input") ||
          label.querySelector("textarea") ||
          label.querySelector('[contenteditable="true"]');
        if (input) return input;

        // Check for "for" attribute
        if (label.htmlFor) {
          return document.getElementById(label.htmlFor);
        }
      }
    }
    return null;
  }

  function findClickableByText(text) {
    const candidates = document.querySelectorAll(
      'span, [role="button"], label, a, div[role="button"]'
    );

    // Exact match on direct text content
    for (const el of candidates) {
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join("");

      if (directText && directText.toLowerCase() === text.toLowerCase()) {
        return el;
      }
    }

    // Fallback: exact full text match on leaf elements
    for (const el of candidates) {
      if (
        el.textContent.trim().toLowerCase() === text.toLowerCase() &&
        el.children.length === 0
      ) {
        return el;
      }
    }

    // Fallback: includes match
    for (const el of candidates) {
      if (
        el.children.length === 0 &&
        el.textContent.trim().toLowerCase().includes(text.toLowerCase())
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
        <span>Auto Parts Filler</span>
        <button id="pfb-close">&times;</button>
      </div>
      <div class="pfb-body">
        <div class="pfb-status" id="pfb-status">Loading form...</div>
        <div class="pfb-info">
          <strong>${esc(data.title)}</strong><br/>
          $${parseFloat(data.price || 0).toFixed(2)}
          ${data.photos?.length ? ` &middot; ${data.photos.length} photo(s)` : ""}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("pfb-close").addEventListener("click", () => {
      overlay.remove();
    });

    // Auto-remove after 2 minutes
    setTimeout(() => {
      if (overlay.parentElement) overlay.remove();
    }, 120000);
  }

  function updateOverlay(msg) {
    const el = document.getElementById("pfb-status");
    if (el) el.textContent = msg;
    log("Status:", msg);
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
