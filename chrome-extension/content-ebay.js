// ============================================
// Content Script: eBay Listing Filler
// Runs on ebay.com/sl/sell*, /sl/prelist/*, /sell/create*
// Two-step flow:
//   Step 1: /sl/prelist/suggest — fill title search, click "Go"
//   Step 2: Full listing form — fill photos, condition, description, price
// ============================================

(function () {
  "use strict";

  const MAX_RETRIES = 120; // 120 * 500ms = 60 seconds max wait
  const RETRY_MS = 500;

  let hasRun = false;
  let lastUrl = "";
  let savedDescription = ""; // saved HTML description for re-fill after eBay resets

  if (document.readyState === "complete") {
    startWithDelay();
  } else {
    window.addEventListener("load", startWithDelay);
  }

  function startWithDelay() {
    setTimeout(init, 2000);
  }

  // Watch for SPA navigation (eBay changes URL without full reload)
  function watchForNavigation() {
    setInterval(async () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        log("URL changed to:", currentUrl);

        const data = await getStorage("ebayPart");
        if (!data) return;

        // If we landed on the listing form page, fill it
        if (isListingFormUrl(currentUrl)) {
          log("Listing form detected via navigation watcher");
          showOverlay(data);
          await handleListingForm(data);
        }
      }
    }, 1500);
  }

  function isListingFormUrl(url) {
    return (
      url.includes("/sl/list") ||
      url.includes("/sl/create") ||
      url.includes("/sell/create") ||
      url.includes("mode=AddItem")
    );
  }

  function isPrelistSuggestUrl(url) {
    return url.includes("/sl/prelist/suggest") || url.includes("/sl/sell");
  }

  function isIdentifyUrl(url) {
    return url.includes("/sl/prelist/identify");
  }

  async function init() {
    if (hasRun) return;
    hasRun = true;

    const url = window.location.href;
    lastUrl = url;
    log("Initializing on", url);

    const data = await getStorage("ebayPart");
    if (!data) {
      log("No eBay part data found. Skipping.");
      return;
    }

    log("Data loaded:", data.title);
    showOverlay(data);

    // Start watching for SPA navigation
    watchForNavigation();

    if (isPrelistSuggestUrl(url)) {
      // Step 1: search page — fill title and submit
      await handlePrelistPage(data);
    } else if (isIdentifyUrl(url)) {
      // Step 2: "Find a match" page — click "Continue without match"
      await handleIdentifyPage(data);
    } else if (isListingFormUrl(url)) {
      // Step 3: full listing form — fill all fields
      await handleListingForm(data);
    } else {
      // Unknown eBay page — might be the listing form with different URL
      // Try to detect form fields
      log("Unknown URL pattern, watching for form fields...");
      watchForForm(data);
    }
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
  // Step 1: Prelist / search page
  // ============================================

  async function handlePrelistPage(data) {
    updateOverlay("Filling item title...");

    const title = buildEbayTitle(data);

    let retries = 0;
    while (retries < MAX_RETRIES) {
      retries++;

      // Look for the search input
      const searchInput =
        document.querySelector('input[placeholder*="Tell us"]') ||
        document.querySelector('input[placeholder*="tell us"]') ||
        document.querySelector('input[placeholder*="selling"]') ||
        document.querySelector('input[aria-label*="selling"]') ||
        document.querySelector('input[type="text"]');

      if (searchInput) {
        log("Search input found, filling title:", title);
        await setInputValue(searchInput, title);
        await sleep(1000);

        // Find and click "Go" or "Continue" button
        const goBtn =
          findClickableByText("Go") ||
          findClickableByText("Continue") ||
          findClickableByText("Search") ||
          document.querySelector('button[type="submit"]');

        if (goBtn) {
          log("Clicking Go/Submit button");
          goBtn.click();
          await sleep(2000);

          // After clicking Go, eBay may show category matches
          // Try to click "Continue without match" or first suggested category
          await handleCategorySelection(data);
        } else {
          // Try submitting the form directly
          const form = searchInput.closest("form");
          if (form) {
            log("Submitting form directly");
            form.dispatchEvent(new Event("submit", { bubbles: true }));
          } else {
            // Press Enter
            searchInput.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                bubbles: true,
              })
            );
          }
          await sleep(2000);
          await handleCategorySelection(data);
        }

        return;
      }

      await sleep(RETRY_MS);
    }

    updateOverlay("Search input not found. Enter title manually.");
  }

  // ============================================
  // Step 2: "Find a match" / identify page
  // ============================================

  // Map our condition values to eBay's "Confirm details" radio labels
  const EBAY_CONDITION_LABELS = {
    new: "New",
    like_new: "New other (see details)",
    excellent: "Used",
    good: "Used",
    fair: "Used",
    used: "Used",
    for_parts: "For parts or not working",
  };

  async function handleIdentifyPage(data) {
    updateOverlay('Looking for "Continue without match"...');

    // Step 2a: click "Continue without match"
    for (let i = 0; i < 30; i++) {
      const continueBtn =
        findClickableByText("Continue without match") ||
        findClickableByText("Continue without selecting") ||
        findClickableByText("Continue without product") ||
        findClickableByText("List without catalog") ||
        document.querySelector('[data-testid="no-match-cta"]') ||
        document.querySelector('[data-testid="skip-match"]');

      if (continueBtn) {
        log('Clicking "Continue without match"');
        continueBtn.click();
        await sleep(2000);

        // Step 2b: "Confirm details" modal — select condition
        await selectConditionInModal(data.condition);
        return;
      }

      await sleep(1000);
    }

    updateOverlay(
      'Could not find "Continue without match". Click it manually.'
    );
  }

  async function selectConditionInModal(condition) {
    const target = EBAY_CONDITION_LABELS[condition] || "Used";
    updateOverlay(`Selecting condition: ${target}...`);

    for (let i = 0; i < 20; i++) {
      // Find all radio-like options in the modal
      // eBay uses radio buttons or clickable labels/spans
      const labels = document.querySelectorAll(
        'label, [role="radio"], [role="option"], span'
      );

      for (const label of labels) {
        const text = label.textContent.trim();
        if (text === target) {
          log("Selecting condition:", target);
          // Click the radio input inside or the label itself
          const radio = label.querySelector('input[type="radio"]');
          if (radio) {
            radio.click();
          } else {
            label.click();
          }
          await sleep(1000);

          // Now click "Continue to listing"
          const continueToListing =
            findClickableByText("Continue to listing") ||
            findClickableByText("Continue") ||
            document.querySelector('[data-testid="continue-to-listing"]');

          if (continueToListing) {
            log('Clicking "Continue to listing"');
            continueToListing.click();
            updateOverlay("Navigating to listing form...");
          } else {
            updateOverlay(
              'Condition selected. Click "Continue to listing" manually.'
            );
          }
          return;
        }
      }

      await sleep(1000);
    }

    updateOverlay("Could not find condition options. Select manually.");
  }

  async function handleCategorySelection(data) {
    updateOverlay("Waiting for category selection...");

    // Wait for category options or the full form to appear
    for (let i = 0; i < 30; i++) {
      // Check if we're already on the listing form (eBay navigated us)
      const titleInput = findTitleInput();
      if (titleInput) {
        log("Full form appeared, switching to form filler");
        await handleListingForm(data);
        return;
      }

      // Look for "Continue without match" or "Continue without selecting a product"
      const continueBtn =
        findClickableByText("Continue without match") ||
        findClickableByText("Continue without selecting") ||
        findClickableByText("Continue without product") ||
        findClickableByText("List without catalog") ||
        document.querySelector('[data-testid="no-match-cta"]') ||
        document.querySelector('[data-testid="skip-match"]');

      if (continueBtn) {
        log("Clicking 'Continue without match'");
        continueBtn.click();
        await sleep(3000);

        // Check again if form appeared
        const form = findTitleInput();
        if (form) {
          await handleListingForm(data);
        } else {
          updateOverlay("Navigating to listing form...");
          // The page may navigate — content script will re-run on the new page
        }
        return;
      }

      // Look for category suggestions — click the first reasonable one
      const suggestions = document.querySelectorAll(
        '[role="option"], [role="listitem"], .srp-river-results li, [data-testid*="suggestion"], [data-testid*="product-card"]'
      );

      if (suggestions.length > 0) {
        // Try "Continue without match" first (better for custom auto parts)
        const skipLink = Array.from(
          document.querySelectorAll("a, button, span, div[role='button']")
        ).find(
          (el) =>
            el.textContent.includes("without") &&
            (el.textContent.includes("match") ||
              el.textContent.includes("product") ||
              el.textContent.includes("catalog"))
        );

        if (skipLink) {
          log("Found skip link, clicking");
          skipLink.click();
          await sleep(3000);
          const form = findTitleInput();
          if (form) await handleListingForm(data);
          return;
        }
      }

      await sleep(1000);
    }

    updateOverlay(
      "Could not auto-select category. Pick a category, then the form will be filled automatically."
    );

    // Watch for the form to appear after user manually selects
    watchForForm(data);
  }

  function watchForForm(data) {
    let checks = 0;
    const interval = setInterval(async () => {
      checks++;
      if (checks > 120) {
        clearInterval(interval);
        return;
      }

      const titleInput = findTitleInput();
      if (titleInput) {
        clearInterval(interval);
        log("Form detected via watcher");
        await handleListingForm(data);
      }
    }, 1000);
  }

  // ============================================
  // Step 2: Full listing form
  // ============================================

  async function handleListingForm(data) {
    updateOverlay("Waiting for listing form...");

    let retries = 0;
    while (retries < MAX_RETRIES) {
      retries++;

      const titleInput = findTitleInput();
      if (titleInput) {
        log("Listing form found after", retries, "retries");
        await sleep(1000);
        await fillForm(data, titleInput);
        return;
      }

      await sleep(RETRY_MS);
    }

    updateOverlay("Listing form not found. Try refreshing the page.");
  }

  async function fillForm(data, titleInput) {
    // 1. Fill Title (eBay limit: 80 chars)
    updateOverlay("Filling title...");
    const title = buildEbayTitle(data);
    await setInputValue(titleInput, title);
    await sleep(1000);

    // 2. Upload photos
    if (data.photos && data.photos.length > 0) {
      updateOverlay("Uploading photos...");
      await uploadPhotos(data.photos);
      await sleep(2000);
    }

    // 3. Set Condition
    updateOverlay("Setting condition...");
    await setCondition(data.condition);
    await sleep(800);

    // 4. Enable Buy It Now toggle
    updateOverlay("Setting Buy It Now...");
    await enableBuyItNow();
    await sleep(1500);

    // 5. Fill Description
    updateOverlay("Filling description...");
    await fillDescription(data);
    await sleep(800);

    // 6. Fill Price
    updateOverlay("Filling price...");
    await fillPrice(data);
    await sleep(500);

    // 7. Fill Quantity (if more than 1) — field only visible in Buy It Now mode
    if (data.quantity && parseInt(data.quantity) > 1) {
      updateOverlay("Setting quantity...");
      await fillQuantity(data.quantity);
      await sleep(500);
    }

    // Data stays in storage so the side panel keeps showing it.
    // It gets overwritten next time a new part is posted.

    updateOverlay("Done! Review and publish your listing.");
    log("Form filling complete!");
  }

  // ============================================
  // Title builder
  // ============================================

  function buildEbayTitle(data) {
    const parts = [data.year, data.make, data.model, data.title].filter(
      Boolean
    );
    const title = parts.join(" ");
    return title.substring(0, 80); // eBay 80-char limit
  }

  // ============================================
  // Find form fields
  // ============================================

  function findTitleInput() {
    // The full listing form has a title input (different from the search input)
    // Look for inputs that suggest a listing title field
    const candidates = [
      document.querySelector('input[aria-label*="itle"]'),
      document.querySelector('input[name="title"]'),
      document.querySelector('[data-testid="title-input"] input'),
      document.querySelector('[data-testid="listing-title"] input'),
    ];

    for (const el of candidates) {
      if (el) return el;
    }

    // Don't fall back to generic input[type="text"] here —
    // that could match the search input on prelist page
    return null;
  }

  // ============================================
  // Photo Upload
  // ============================================

  async function uploadPhotos(photoUrls) {
    let fileInput = findFileInput();

    if (!fileInput) {
      // Try clicking an "Add photos" button to reveal file input
      const addBtn =
        document.querySelector('[aria-label*="hoto"]') ||
        document.querySelector('[aria-label*="image"]') ||
        findClickableByText("Add photos") ||
        findClickableByText("Upload photos");

      if (addBtn) {
        addBtn.click();
        await sleep(1500);
      }

      fileInput = findFileInput();
    }

    if (!fileInput) {
      log("No file input found for photos");
      updateOverlay("Could not find photo upload. Add photos manually.");
      return;
    }

    log("File input found, fetching", photoUrls.length, "images...");

    const files = [];
    for (let i = 0; i < photoUrls.length; i++) {
      try {
        updateOverlay(`Downloading image ${i + 1}/${photoUrls.length}...`);
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
        try {
          const resp = await fetch(photoUrls[i]);
          const blob = await resp.blob();
          const ext = blob.type.split("/")[1] || "jpg";
          const file = new File([blob], `photo_${i + 1}.${ext}`, {
            type: blob.type,
          });
          files.push(file);
        } catch (e) {
          log(`Direct fetch also failed for image ${i + 1}:`, e.message);
        }
      }
    }

    if (files.length === 0) {
      updateOverlay("Could not download photos. Add them manually.");
      return;
    }

    const dataTransfer = new DataTransfer();
    files.forEach((f) => dataTransfer.items.add(f));

    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));

    log(`Set ${files.length} photos on file input`);
    updateOverlay(`${files.length} photo(s) uploading...`);

    await sleep(1500);

    // Also try drag-and-drop as fallback
    await tryDragDrop(files);
  }

  function findFileInput() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
      if (input.accept && input.accept.includes("image")) {
        return input;
      }
    }
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
            const binary = atob(response.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            resolve(
              new Blob([bytes], { type: response.type || "image/jpeg" })
            );
          } else {
            reject(new Error("No image data returned"));
          }
        }
      );
    });
  }

  async function tryDragDrop(files) {
    const dropZone =
      document.querySelector('[aria-label*="hoto"]') ||
      document.querySelector('[data-testid="photos"]') ||
      document.querySelector(".photo-upload-area") ||
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
  // Condition
  // ============================================

  const CONDITION_MAP = {
    new: "New",
    like_new: "Used",
    excellent: "Used",
    good: "Used",
    fair: "Used",
    used: "Used",
    for_parts: "For parts or not working",
  };

  async function setCondition(condition) {
    const target = CONDITION_MAP[condition] || "Used";

    const conditionBtn =
      document.querySelector('[aria-label*="ondition"]') ||
      document.querySelector('[data-testid="condition"] button') ||
      findClickableByText("Condition") ||
      findClickableByText("Select condition");

    if (!conditionBtn) {
      log("Condition selector not found");
      return;
    }

    conditionBtn.click();
    await sleep(1000);

    for (let i = 0; i < 15; i++) {
      const options = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="listbox"] [role="option"], li[role="option"]'
      );

      for (const opt of options) {
        const text = opt.textContent.trim();
        if (text === target || text.startsWith(target)) {
          opt.click();
          log("Condition set:", text);
          return;
        }
      }

      const spans = document.querySelectorAll(
        '[role="listbox"] span, [role="menu"] span'
      );
      for (const span of spans) {
        if (span.textContent.trim() === target) {
          const clickTarget =
            span.closest("[role='option']") ||
            span.closest("[role='menuitem']") ||
            span.closest("li") ||
            span;
          clickTarget.click();
          log("Condition set (span):", target);
          return;
        }
      }

      await sleep(400);
    }

    log("Could not select condition:", target);
  }

  // ============================================
  // Description
  // ============================================

  function buildDescriptionHtml(data) {
    const lines = [];

    // Part description from the listing
    let desc = data.description || "";
    if (data.serial_number) desc += `\nPart #: ${data.serial_number}`;
    if (data.vin) desc += `\nVIN: ${data.vin}`;
    if ((data.quantity || 1) > 1) desc += `\nQuantity: ${data.quantity}`;

    const descHtml = desc.trim().split("\n").map(l => l.trim()).filter(Boolean).join("<br>");

    const sectionStyle = 'style="margin:0;padding:8px 12px;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.5"';
    const headerStyle = 'style="margin:0 0 4px 0;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px"';

    lines.push(`<div style="max-width:800px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222">`);

    // Main description
    if (descHtml) {
      lines.push(`<div style="padding:12px;font-size:15px;margin-bottom:8px">${descHtml}</div>`);
    }

    // Divider
    lines.push(`<hr style="border:none;border-top:2px solid #cc0000;margin:8px 0">`);

    // ITEM CONDITION
    lines.push(`<div ${sectionStyle}>`);
    lines.push(`<p ${headerStyle}><span style="color:#cc0000">&#9679;</span> ITEM CONDITION</p>`);
    lines.push(`<p style="margin:0;color:#444">Tested and verified working before removal. May show normal signs of wear consistent with age and use. Please inspect all photos carefully &mdash; what you see is what you will receive.</p>`);
    lines.push(`</div>`);

    // COMPATIBILITY
    lines.push(`<div ${sectionStyle}>`);
    lines.push(`<p ${headerStyle}><span style="color:#cc0000">&#9679;</span> COMPATIBILITY</p>`);
    lines.push(`<p style="margin:0;color:#444"><strong>PLEASE VERIFY COMPATIBILITY BEFORE BUYING.</strong> It is the buyer's responsibility to determine whether the part will fit his/her vehicle. Please make sure to match the part number with your original part. Verify the fit with your local dealer or an independent source before purchasing.</p>`);
    lines.push(`<p style="margin:4px 0 0 0;color:#444">Please do not buy just to check and diagnose your vehicle problem.</p>`);
    lines.push(`</div>`);

    // SHIPPING
    lines.push(`<div ${sectionStyle}>`);
    lines.push(`<p ${headerStyle}><span style="color:#cc0000">&#9679;</span> SHIPPING</p>`);
    lines.push(`<p style="margin:0;color:#444">Small/medium items ship via USPS, UPS, or FedEx (1&ndash;3 business days processing). Large/oversized items (bumpers, doors, hoods, engines, transmissions, seats, etc.) are <strong>LOCAL PICKUP ONLY</strong>. Buyer may arrange their own freight carrier at their own expense. Contact us for address.</p>`);
    lines.push(`</div>`);

    // RETURNS
    lines.push(`<div ${sectionStyle}>`);
    lines.push(`<p ${headerStyle}><span style="color:#cc0000">&#9679;</span> RETURNS</p>`);
    lines.push(`<p style="margin:0;color:#444">Returns accepted within 30 days ONLY if the item is non-functional or significantly differs from the description. Buyer is fully responsible for the shipping cost of the return. Shipping and handling fees are non-refundable. You will be refunded the purchase price minus our shipping costs as soon as the item is returned to us.</p>`);
    lines.push(`<p style="margin:4px 0 0 0;color:#444">All electronics are tested before removal. If not functional, we will not sell. Defective items are stated accordingly and sold for parts only. All electronic items are not eligible for return. We are not responsible for labor costs related to installation or removal.</p>`);
    lines.push(`</div>`);

    // CONTACT
    lines.push(`<div ${sectionStyle}>`);
    lines.push(`<p ${headerStyle}><span style="color:#cc0000">&#9679;</span> CONTACT</p>`);
    lines.push(`<p style="margin:0;color:#444">Questions? Message us through eBay &mdash; we respond within 24 hours. Please ask before purchasing!</p>`);
    lines.push(`</div>`);

    // FEEDBACK
    lines.push(`<div ${sectionStyle}>`);
    lines.push(`<p ${headerStyle}><span style="color:#cc0000">&#9679;</span> FEEDBACK</p>`);
    lines.push(`<p style="margin:0;color:#444">Once you have received your item in satisfactory condition, please leave us feedback. If there is a concern or issue, please contact us first and we will do our best to resolve the problem.</p>`);
    lines.push(`</div>`);

    lines.push(`<hr style="border:none;border-top:2px solid #cc0000;margin:8px 0">`);
    lines.push(`</div>`);

    return lines.join("\n");
  }

  async function enableHtmlEditor() {
    // Look for "Show HTML editor" checkbox/toggle/link
    // eBay may use a checkbox, a link, or a toggle
    const candidates = document.querySelectorAll(
      'input[type="checkbox"], label, a, button, span, [role="checkbox"], [role="switch"]'
    );

    for (const el of candidates) {
      const text = el.textContent?.trim().toLowerCase() || "";
      const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();

      if (
        text.includes("html editor") ||
        text.includes("html view") ||
        text.includes("show html") ||
        ariaLabel.includes("html editor") ||
        ariaLabel.includes("html view")
      ) {
        // If it's a checkbox, check it
        if (el.type === "checkbox" || el.getAttribute("role") === "checkbox") {
          if (!el.checked && el.getAttribute("aria-checked") !== "true") {
            el.click();
            log("HTML editor checkbox enabled");
            await sleep(1000);
            return true;
          }
          log("HTML editor already enabled");
          return true;
        }

        // If it's a label, click it (will toggle the associated checkbox)
        if (el.tagName === "LABEL") {
          el.click();
          log("HTML editor enabled via label click");
          await sleep(1000);
          return true;
        }

        // Any other clickable element
        el.click();
        log("HTML editor enabled via click:", el.tagName);
        await sleep(1000);
        return true;
      }
    }

    // Also try finding by partial text in surrounding containers
    const allText = document.querySelectorAll("span, label, a, div");
    for (const el of allText) {
      if (
        el.children.length === 0 &&
        el.textContent.trim().toLowerCase().includes("html")
      ) {
        // Check if there's a checkbox nearby
        const container = el.closest("label, div, fieldset");
        if (container) {
          const checkbox =
            container.querySelector('input[type="checkbox"]') ||
            container.querySelector('[role="checkbox"]');
          if (checkbox) {
            if (
              !checkbox.checked &&
              checkbox.getAttribute("aria-checked") !== "true"
            ) {
              checkbox.click();
              log("HTML editor checkbox found near text, enabled");
              await sleep(1000);
              return true;
            }
          }
        }

        // The text element itself might be clickable
        if (
          el.tagName === "A" ||
          el.tagName === "SPAN" ||
          el.style.cursor === "pointer"
        ) {
          el.click();
          log("HTML editor enabled via nearby text click");
          await sleep(1000);
          return true;
        }
      }
    }

    log("HTML editor toggle not found");
    return false;
  }

  async function fillDescription(data) {
    // First, enable the HTML editor
    await enableHtmlEditor();

    const finalDesc = buildDescriptionHtml(data);

    // After enabling HTML editor, re-search for the description field
    // (it may have changed from a rich editor to a textarea)
    const descInput =
      document.querySelector('textarea[aria-label*="escription"]') ||
      document.querySelector('textarea[placeholder*="escription"]') ||
      document.querySelector('[data-testid="description"] textarea') ||
      document.querySelector(
        '[aria-label*="escription"][contenteditable="true"]'
      ) ||
      findField("Description") ||
      findField("Tell buyers about your item");

    if (descInput) {
      savedDescription = finalDesc;
      await setInputValue(descInput, finalDesc);
      log("Description filled (HTML)");
      // Watch for eBay resetting description (e.g. when toggling Local Pickup)
      watchDescriptionField();
    } else {
      log("Description field not found");
    }
  }

  // Re-fill description if eBay resets it (shipping changes, etc.)
  function watchDescriptionField() {
    if (!savedDescription) return;

    let refilling = false;
    const CHECK_INTERVAL = 2000;
    const MAX_CHECKS = 300; // 10 minutes
    let checks = 0;

    const interval = setInterval(async () => {
      checks++;
      if (checks > MAX_CHECKS || !savedDescription) {
        clearInterval(interval);
        return;
      }
      if (refilling) return;

      const descInput =
        document.querySelector('textarea[aria-label*="escription"]') ||
        document.querySelector('textarea[placeholder*="escription"]') ||
        document.querySelector('[data-testid="description"] textarea') ||
        document.querySelector('[aria-label*="escription"][contenteditable="true"]') ||
        findField("Description");

      if (!descInput) return;

      const currentValue = descInput.value || descInput.textContent || "";
      // If description was cleared or significantly shortened (eBay reset it)
      if (currentValue.length < savedDescription.length * 0.5 && savedDescription.length > 50) {
        refilling = true;
        log("Description was reset by eBay! Re-filling...");

        // Re-enable HTML editor first
        await enableHtmlEditor();
        await sleep(500);

        // Re-find the field (may have changed after HTML toggle)
        const freshInput =
          document.querySelector('textarea[aria-label*="escription"]') ||
          document.querySelector('textarea[placeholder*="escription"]') ||
          document.querySelector('[data-testid="description"] textarea') ||
          document.querySelector('[aria-label*="escription"][contenteditable="true"]') ||
          findField("Description");

        if (freshInput) {
          await setInputValue(freshInput, savedDescription);
          log("Description re-filled successfully");
        }
        refilling = false;
      }
    }, CHECK_INTERVAL);
  }

  // ============================================
  // Price
  // ============================================

  async function enableBuyItNow() {
    // Find the "Buy It Now" heading, walk up to find the checkbox toggle
    const allEls = document.querySelectorAll("*");
    for (const el of allEls) {
      if (el.children.length > 3) continue;
      const text = el.textContent.trim();
      if (text !== "Buy It Now") continue;

      log(`Found "Buy It Now" in <${el.tagName}>`);

      // Walk up 1-5 levels looking for a checkbox
      let container = el.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const cb = container.querySelector('input[type="checkbox"]');
        if (cb) {
          log(`Buy It Now checkbox found ${i + 1} levels up, checked: ${cb.checked}`);
          if (!cb.checked) {
            cb.click();
            log("Buy It Now checkbox clicked ON");
            await sleep(2000);
          } else {
            log("Buy It Now already ON");
          }
          return;
        }
        container = container.parentElement;
      }
    }
    log("Buy It Now toggle not found");
  }

  async function fillPrice(data) {
    const price = data.price
      ? Math.round(parseFloat(data.price)).toString()
      : "";
    if (!price) return;

    // Find all price-like inputs on the page
    const allInputs = document.querySelectorAll('input');
    let binPriceInput = null;

    for (const input of allInputs) {
      // Check if this input is inside the "Buy It Now" section
      let parent = input.parentElement;
      for (let i = 0; i < 6 && parent; i++) {
        const text = parent.textContent || "";
        if (text.includes("Buy It Now") && text.length < 400) {
          // This input is in the Buy It Now section
          // Make sure it looks like a price field (number/text input, not checkbox)
          if (input.type === "text" || input.type === "number" || input.type === "") {
            binPriceInput = input;
            log("Found price input in Buy It Now section");
            break;
          }
        }
        parent = parent.parentElement;
      }
      if (binPriceInput) break;
    }

    // Fallback: try standard selectors
    if (!binPriceInput) {
      binPriceInput =
        document.querySelector('input[aria-label*="rice"]') ||
        document.querySelector('input[placeholder*="rice"]') ||
        document.querySelector('[data-testid="price"] input') ||
        findField("Price") ||
        findField("Buy It Now price");
    }

    if (binPriceInput) {
      await setInputValue(binPriceInput, price);
      log("Price filled:", price);
    } else {
      log("Price field not found");
    }
  }

  async function fillQuantity(quantity) {
    const qty = parseInt(quantity).toString();

    // 1. Click "More options" to reveal Quantity section
    const moreOptions =
      findClickableByText("More options") ||
      findClickableByText("More Options");

    if (moreOptions) {
      moreOptions.click();
      log("Clicked 'More options' to reveal Quantity");
      await sleep(1500);
    }

    // 2. Quantity has its own toggle switch — find and enable it
    const allToggles = document.querySelectorAll(
      '[role="switch"], button[aria-checked]'
    );
    for (const toggle of allToggles) {
      const label = (toggle.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("quantity")) {
        if (toggle.getAttribute("aria-checked") !== "true") {
          toggle.click();
          log("Quantity toggle turned ON via aria-label");
          await sleep(1000);
        }
        break;
      }

      // Check nearby text
      let container = toggle.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const text = container.textContent || "";
        if (text.includes("Quantity") && !text.includes("Pricing")) {
          if (toggle.getAttribute("aria-checked") !== "true") {
            toggle.click();
            log("Quantity toggle turned ON");
            await sleep(1000);
          }
          container = null; // break outer
          break;
        }
        container = container.parentElement;
      }
      if (!container) break; // was found
    }

    // 3. Now fill the quantity input
    await sleep(500);
    const qtyInput =
      document.querySelector('input[aria-label*="uantity"]') ||
      document.querySelector('input[placeholder*="uantity"]') ||
      document.querySelector('[data-testid="quantity"] input') ||
      findField("Quantity") ||
      findField("Available quantity");

    if (qtyInput) {
      await setInputValue(qtyInput, qty);
      log("Quantity filled:", qty);
    } else {
      log("Quantity input field not found after toggle");
    }
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

    // contentEditable elements
    if (
      el.getAttribute("contenteditable") === "true" ||
      el.isContentEditable
    ) {
      el.textContent = "";
      el.innerHTML = "";
      el.focus();
      await sleep(50);

      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      await sleep(50);

      if (value.length <= 100) {
        document.execCommand("insertText", false, value);
      } else {
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

    const tracker = el._valueTracker;
    if (tracker) {
      tracker.setValue(prev);
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true })
    );
    el.dispatchEvent(
      new KeyboardEvent("keyup", { key: "a", bubbles: true })
    );

    await sleep(100);
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    await sleep(100);

    if (el.value !== value) {
      log("Value mismatch, retrying with fallback...");
      el.focus();
      await sleep(50);
      el.select?.();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
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
      findInputByLabelText(label)
    );
  }

  function findInputByLabelText(text) {
    const labels = document.querySelectorAll("label");
    for (const label of labels) {
      if (
        label.textContent.trim().toLowerCase().includes(text.toLowerCase())
      ) {
        const input =
          label.querySelector("input") ||
          label.querySelector("textarea") ||
          label.querySelector('[contenteditable="true"]');
        if (input) return input;

        if (label.htmlFor) {
          return document.getElementById(label.htmlFor);
        }
      }
    }
    return null;
  }

  function findClickableByText(text) {
    const candidates = document.querySelectorAll(
      'button, span, [role="button"], label, a, div[role="button"]'
    );

    for (const el of candidates) {
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join("");

      if (directText && directText.toLowerCase() === text.toLowerCase()) {
        return el;
      }
    }

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

  // ============================================
  // Overlay
  // ============================================

  function showOverlay(data) {
    const existing = document.getElementById("parts-ebay-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "parts-ebay-overlay";
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#e53238;color:white;font-weight:700;font-size:13px;border-radius:12px 12px 0 0;">
        <span>eBay Auto-Filler</span>
        <button id="peb-close" style="background:none;border:none;color:white;font-size:16px;cursor:pointer;padding:0 4px;opacity:0.8;">&times;</button>
      </div>
      <div style="padding:12px 14px;">
        <div id="peb-status" style="padding:8px 10px;background:#fef2f2;color:#e53238;border-radius:6px;font-size:12px;font-weight:600;margin-bottom:10px;">Loading form...</div>
        <div style="font-size:12px;color:#374151;line-height:1.5;">
          <strong>${esc(data.title)}</strong><br/>
          $${parseFloat(data.price || 0).toFixed(2)}
          ${data.photos?.length ? ` &middot; ${data.photos.length} photo(s)` : ""}
        </div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      overflow: hidden;
    `;
    document.body.appendChild(overlay);

    document.getElementById("peb-close").addEventListener("click", () => {
      overlay.remove();
    });

    setTimeout(() => {
      if (overlay.parentElement) overlay.remove();
    }, 120000);
  }

  function updateOverlay(msg) {
    const el = document.getElementById("peb-status");
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
    console.log("[eBay Filler]", ...args);
  }
})();
