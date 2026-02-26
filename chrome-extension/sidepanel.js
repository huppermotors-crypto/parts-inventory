// ============================================
// Side Panel: Part Details Viewer
// Shows eBay/FB part data for review & copy
// ============================================

(function () {
  "use strict";

  let currentData = null;
  let currentTab = "details";

  // Load data from both storage keys
  async function loadData() {
    const result = await chrome.storage.local.get(["ebayPart", "scrapedPart"]);
    currentData = result.ebayPart || result.scrapedPart || null;
    render();
  }

  // Listen for storage changes (new part posted)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.ebayPart || changes.scrapedPart) {
      loadData();
    }
  });

  // Tab switching
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentTab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      render();
    });
  });

  function render() {
    const content = document.getElementById("content");
    const empty = document.getElementById("empty-state");
    const headerTitle = document.getElementById("header-title");
    const headerSub = document.getElementById("header-sub");
    const platforms = document.getElementById("platforms");

    if (!currentData) {
      content.innerHTML = "";
      content.appendChild(empty);
      empty.style.display = "";
      headerTitle.textContent = "Part Details";
      headerSub.textContent = "Post a part from the dashboard to see details here";
      platforms.innerHTML = "";
      return;
    }

    empty.style.display = "none";

    // Header
    const vehicle = [currentData.year, currentData.make, currentData.model]
      .filter(Boolean)
      .join(" ");
    headerTitle.textContent = currentData.title || "Untitled Part";
    headerSub.textContent = vehicle || "No vehicle info";

    // Platform badges
    let platformsHtml = "";
    if (currentData._source === "ebay" || currentData.ebay_listed_at) {
      platformsHtml += '<span class="platform-badge ebay">eBay</span>';
    }
    if (currentData._source === "fb" || currentData.fb_posted_at) {
      platformsHtml += '<span class="platform-badge fb">Facebook</span>';
    }
    if (!platformsHtml) {
      platformsHtml = '<span class="platform-badge ebay">Posting...</span>';
    }
    platforms.innerHTML = platformsHtml;

    // Render active tab
    switch (currentTab) {
      case "details":
        content.innerHTML = renderDetails();
        break;
      case "photos":
        content.innerHTML = renderPhotos();
        break;
      case "description":
        content.innerHTML = renderDescription();
        break;
    }

    // Attach copy handlers
    content.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.dataset.copy;
        copyToClipboard(text, btn);
      });
    });

    // Photo click → open in new tab
    content.querySelectorAll(".photo-thumb").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const url = thumb.dataset.url;
        if (url) chrome.tabs.create({ url, active: false });
      });
    });
  }

  // ============================================
  // Details tab
  // ============================================
  function renderDetails() {
    const d = currentData;
    const price = parseFloat(d.price || 0);
    const qty = parseInt(d.quantity || 1);
    const vehicle = [d.year, d.make, d.model].filter(Boolean).join(" ");
    const conditionMap = {
      new: ["New", "badge-green"],
      like_new: ["Like New", "badge-blue"],
      excellent: ["Excellent", "badge-blue"],
      good: ["Good", "badge-amber"],
      fair: ["Fair", "badge-amber"],
      used: ["Used", "badge-amber"],
      for_parts: ["For Parts", "badge-red"],
    };
    const [condLabel, condClass] = conditionMap[d.condition] || ["Used", "badge-gray"];

    const ebayTitle = [d.year, d.make, d.model, d.title].filter(Boolean).join(" ").substring(0, 80);

    let html = "";

    // Price card
    html += `
      <div class="card">
        <div class="card-body">
          <div class="field">
            <div class="field-label">Price</div>
            <div class="field-value price">$${price.toFixed(2)}</div>
            <button class="copy-btn" data-copy="${price.toFixed(2)}">Copy</button>
          </div>
        </div>
      </div>
    `;

    // Main info card
    html += `<div class="card">`;
    html += `<div class="card-header"><span class="label">Part Info</span></div>`;
    html += `<div class="card-body">`;

    html += field("Title", d.title || "—", d.title);
    html += field("eBay Title", ebayTitle, ebayTitle);

    if (vehicle) {
      html += field("Vehicle", vehicle, vehicle);
    }

    html += `
      <div class="field">
        <div class="field-label">Condition</div>
        <div class="field-value"><span class="badge ${condClass}">${condLabel}</span></div>
        <button class="copy-btn" data-copy="${condLabel}">Copy</button>
      </div>
    `;

    if (qty > 1) {
      html += field("Quantity", qty.toString(), qty.toString());
    }

    if (d.serial_number) {
      html += field("Part #", d.serial_number, d.serial_number);
    }

    if (d.vin) {
      html += field("VIN", d.vin, d.vin);
    }

    if (d.category) {
      html += field("Category", d.category, d.category);
    }

    if (d.stock_number) {
      html += field("Stock #", d.stock_number, d.stock_number);
    }

    html += `</div></div>`;

    // Photos summary
    const photoCount = d.photos?.length || 0;
    html += `
      <div class="card">
        <div class="card-body">
          <div class="field">
            <div class="field-label">Photos</div>
            <div class="field-value">${photoCount} photo${photoCount !== 1 ? "s" : ""}</div>
            <button class="copy-btn" data-copy="${photoCount}">Copy #</button>
          </div>
        </div>
      </div>
    `;

    // Copy all button
    const allText = [
      `Title: ${d.title}`,
      `eBay Title: ${ebayTitle}`,
      vehicle ? `Vehicle: ${vehicle}` : "",
      `Price: $${price.toFixed(2)}`,
      `Condition: ${condLabel}`,
      qty > 1 ? `Quantity: ${qty}` : "",
      d.serial_number ? `Part #: ${d.serial_number}` : "",
      d.vin ? `VIN: ${d.vin}` : "",
      `Photos: ${photoCount}`,
    ]
      .filter(Boolean)
      .join("\n");

    html += `<button class="copy-all-btn" data-copy="${esc(allText)}">📋 Copy All Details</button>`;

    return html;
  }

  // ============================================
  // Photos tab
  // ============================================
  function renderPhotos() {
    const photos = currentData.photos || [];
    if (photos.length === 0) {
      return `
        <div class="empty" style="padding:40px 20px">
          <div class="icon">📷</div>
          <h2>No photos</h2>
          <p>This part has no photos attached</p>
        </div>
      `;
    }

    let html = `<div class="card">`;
    html += `<div class="card-header">
      <span class="label">${photos.length} Photo${photos.length !== 1 ? "s" : ""}</span>
      <button class="copy-btn" data-copy="${esc(photos.join("\n"))}">Copy URLs</button>
    </div>`;
    html += `<div class="photos-grid">`;
    photos.forEach((url, i) => {
      html += `
        <div class="photo-thumb" data-url="${esc(url)}" title="Photo ${i + 1} — click to open">
          <img src="${esc(url)}" alt="Photo ${i + 1}" loading="lazy" />
        </div>
      `;
    });
    html += `</div></div>`;

    // Individual URLs
    html += `<div class="card">`;
    html += `<div class="card-header"><span class="label">Photo URLs</span></div>`;
    html += `<div class="card-body">`;
    photos.forEach((url, i) => {
      const short = url.split("/").pop().substring(0, 30) + "...";
      html += `
        <div class="field">
          <div class="field-label">#${i + 1}</div>
          <div class="field-value" style="font-size:11px;color:#64748b;word-break:break-all">${short}</div>
          <button class="copy-btn" data-copy="${esc(url)}">Copy</button>
        </div>
      `;
    });
    html += `</div></div>`;

    return html;
  }

  // ============================================
  // Description tab
  // ============================================
  function renderDescription() {
    const d = currentData;
    const desc = d.description || "No description";
    let html = "";

    // Part description
    html += `<div class="card">`;
    html += `<div class="card-header">
      <span class="label">Part Description</span>
      <button class="copy-btn" data-copy="${esc(desc)}">Copy</button>
    </div>`;
    html += `<div class="desc-box">${escHtml(desc)}</div>`;
    html += `</div>`;

    // Extra fields that go into eBay description
    let extras = "";
    if (d.serial_number) extras += `Part #: ${d.serial_number}\n`;
    if (d.vin) extras += `VIN: ${d.vin}\n`;
    if ((d.quantity || 1) > 1) extras += `Quantity: ${d.quantity}\n`;

    if (extras) {
      html += `<div class="card">`;
      html += `<div class="card-header">
        <span class="label">Extra Info</span>
        <button class="copy-btn" data-copy="${esc(extras.trim())}">Copy</button>
      </div>`;
      html += `<div class="desc-box">${escHtml(extras.trim())}</div>`;
      html += `</div>`;
    }

    // Full eBay description (what gets pasted)
    const fullDesc = [
      desc,
      extras.trim(),
      BOILERPLATE_PREVIEW,
    ].filter(Boolean).join("\n\n");

    html += `<div class="card">`;
    html += `<div class="card-header">
      <span class="label">Full eBay Description</span>
      <button class="copy-btn" data-copy="${esc(fullDesc)}">Copy All</button>
    </div>`;
    html += `<div class="boilerplate-box">${escHtml(fullDesc)}</div>`;
    html += `</div>`;

    return html;
  }

  // ============================================
  // Helpers
  // ============================================
  function field(label, display, copyValue) {
    return `
      <div class="field">
        <div class="field-label">${label}</div>
        <div class="field-value">${escHtml(display)}</div>
        <button class="copy-btn" data-copy="${esc(copyValue || display)}">Copy</button>
      </div>
    `;
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 1500);
    });
  }

  function esc(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  const BOILERPLATE_PREVIEW = `——————————————————

ITEM CONDITION:
Tested and verified working before removal. May show normal signs of wear consistent with age and use. Please inspect all photos carefully — what you see is what you will receive.

COMPATIBILITY:
PLEASE VERIFY COMPATIBILITY BEFORE BUYING. IT IS THE BUYER'S RESPONSIBILITY TO DETERMINE WHETHER THE PART WILL FIT HIS/HER CAR OR NOT. PLEASE MAKE SURE TO MATCH THE PART NUMBER WITH YOUR ORIGINAL PART. WHAT YOU SEE IN THE PHOTOS IS WHAT YOU WILL RECEIVE. Please ask questions prior to purchasing and verify the fit in your application with your local dealer or an independent source.
Please do not buy just to check and diagnose your vehicle problem.

SHIPPING:
Small/medium items ship via USPS, UPS, or FedEx (1-3 business days processing). Large/oversized items (bumpers, doors, hoods, engines, transmissions, seats, etc.) are LOCAL PICKUP ONLY. If listed as "Local Pickup" — item must be picked up from our location. Buyer may arrange their own freight carrier at their own expense. Contact us for address.

RETURNS:
Returns accepted within 30 days ONLY if the item is non-functional or significantly differs from the description. Buyer is fully responsible for the shipping cost of the return. Shipping and handling fees are non-refundable. Most of our products are offered with free shipping, meaning shipping has been included in the price. You will be refunded the purchase price minus our shipping costs as soon as item is returned to us.
All electronics are tested before removed from vehicle. IF NOT FUNCTIONAL, WE WILL NOT SELL. If the item is defective we will state accordingly and is sold for parts only. All electronic items are not eligible for return.
We are not responsible for labor costs related to installation or removal.

WARRANTY:
30-day warranty on all parts.

CONTACT:
Questions? Message us through eBay — we respond within 24 hours. Please ask before purchasing!

IMPORTANT:
Once you have received your item in satisfactory condition, please leave us feedback. If there is a concern or issue that would cause you to want to leave negative feedback, please contact us first and we will do our best to resolve the problem and satisfy the situation.`;

  // Initial load
  loadData();
})();
