// ============================================
// Popup Script
// ============================================

const btnScrape = document.getElementById("btn-scrape");
const btnOpenFb = document.getElementById("btn-open-fb");
const btnClear = document.getElementById("btn-clear");
const statusEl = document.getElementById("status");
const statusIcon = document.getElementById("status-icon");
const statusText = document.getElementById("status-text");
const previewEl = document.getElementById("preview");

// Load saved data on popup open
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("scrapedPart", (result) => {
    if (result.scrapedPart) {
      showPreview(result.scrapedPart);
      setStatus("scraped", "✅", "Data ready — click to post to FB");
      btnOpenFb.classList.remove("hidden");
    } else {
      checkCurrentTab();
    }
  });
});

// Check if we're on a product page
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = tab.url;
      const isProductPage =
        url.includes("/parts/") &&
        (url.includes("localhost") || url.includes("vercel.app"));

      if (isProductPage) {
        setStatus("idle", "📦", "Product page detected — ready to scrape");
      } else {
        setStatus("idle", "⏳", "Navigate to a product page (/parts/[id])");
        btnScrape.disabled = true;
      }
    }
  } catch (e) {
    // ignore
  }
}

// Scrape & Post
btnScrape.addEventListener("click", async () => {
  btnScrape.disabled = true;
  setStatus("scraping", "⏳", "Scraping product data...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      setStatus("error", "❌", "No active tab found");
      btnScrape.disabled = false;
      return;
    }

    // Send message to background to orchestrate
    chrome.runtime.sendMessage({ action: "SCRAPE_AND_POST" });

    // Wait a beat then check storage
    setTimeout(() => {
      chrome.storage.local.get("scrapedPart", (result) => {
        if (result.scrapedPart) {
          showPreview(result.scrapedPart);
          setStatus("scraped", "✅", "Posted! Images downloading. Check FB tab.");
          btnOpenFb.classList.remove("hidden");
        }
        btnScrape.disabled = false;
      });
    }, 2000);
  } catch (err) {
    setStatus("error", "❌", "Error: " + err.message);
    btnScrape.disabled = false;
  }
});

// Re-open FB
btnOpenFb.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "OPEN_FB_MARKETPLACE" });
});

// Clear data
btnClear.addEventListener("click", () => {
  chrome.storage.local.remove("scrapedPart", () => {
    previewEl.classList.add("hidden");
    btnOpenFb.classList.add("hidden");
    setStatus("idle", "⏳", "Data cleared. Navigate to a product page.");
    btnScrape.disabled = false;
  });
});

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "STATUS_UPDATE") {
    if (message.status === "error") {
      setStatus("error", "❌", message.message);
      btnScrape.disabled = false;
    } else if (message.status === "scraped" && message.data) {
      showPreview(message.data);
      setStatus("scraped", "✅", "Data scraped! Opening FB...");
      btnOpenFb.classList.remove("hidden");
    }
  }
});

// Helpers
function setStatus(type, icon, text) {
  statusEl.className = `status status-${type}`;
  statusIcon.textContent = icon;
  statusText.textContent = text;
}

function showPreview(data) {
  document.getElementById("preview-title").textContent = data.title || "—";
  document.getElementById("preview-price").textContent = data.price
    ? `$${parseFloat(data.price).toFixed(2)}`
    : "—";
  document.getElementById("preview-condition").textContent =
    (data.condition || "used").replace("_", " ");
  document.getElementById("preview-photos").textContent = data.photos
    ? `${data.photos.length} image(s)`
    : "None";
  previewEl.classList.remove("hidden");
}
