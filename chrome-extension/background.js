// ============================================
// Background Service Worker
// Coordinates scraping → download images → open FB tab
// ============================================

// Allowed origins for message validation
const ALLOWED_ORIGINS = [
  "facebook.com",
  "www.facebook.com",
  "localhost",
  "onrender.com",
  "vercel.app",
];

function isTrustedSender(sender) {
  // Messages from our own extension (popup, content scripts)
  if (sender.id === chrome.runtime.id) return true;
  // Messages from allowed host permissions
  if (sender.url) {
    try {
      const hostname = new URL(sender.url).hostname;
      return ALLOWED_ORIGINS.some(
        (origin) => hostname === origin || hostname.endsWith("." + origin)
      );
    } catch {
      return false;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    console.warn("[BG] Blocked message from untrusted sender:", sender.url);
    sendResponse({ error: "Untrusted sender" });
    return;
  }

  if (message.action === "SCRAPE_AND_POST") {
    handleScrapeAndPost(sender.tab?.id);
    sendResponse({ status: "started" });
    return true;
  }

  if (message.action === "DOWNLOAD_IMAGES") {
    handleImageDownloads(message.imageUrls, message.title);
    sendResponse({ status: "downloading" });
    return true;
  }

  if (message.action === "GET_SCRAPED_DATA") {
    chrome.storage.local.get("scrapedPart", (result) => {
      sendResponse({ data: result.scrapedPart || null });
    });
    return true; // async
  }

  if (message.action === "OPEN_FB_MARKETPLACE") {
    chrome.tabs.create({
      url: "https://www.facebook.com/marketplace/create/listing",
      active: true,
    });
    sendResponse({ status: "opened" });
    return true;
  }

  // Direct post from admin dashboard — data already provided, no scraping needed
  if (message.action === "DIRECT_POST") {
    handleDirectPost(message.data);
    sendResponse({ status: "started" });
    return true;
  }

  // Fetch image from content script (CORS workaround — background has no origin restrictions)
  if (message.action === "FETCH_IMAGE") {
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const FETCH_TIMEOUT_MS = 15000; // 15 seconds

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(message.url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const contentType = r.headers.get("content-type") || "image/jpeg";
        return r.arrayBuffer().then((buf) => ({ buf, contentType }));
      })
      .then(({ buf, contentType }) => {
        clearTimeout(timeoutId);
        if (buf.byteLength > MAX_IMAGE_SIZE) {
          throw new Error(`Image too large: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
        }
        // Convert ArrayBuffer to base64 in chunks (avoid stack overflow on large images)
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + chunkSize)
          );
        }
        sendResponse({ data: btoa(binary), type: contentType });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        const msg = err.name === "AbortError" ? "Image fetch timed out" : err.message;
        console.error("[BG] FETCH_IMAGE error:", msg);
        sendResponse({ error: msg });
      });
    return true; // async
  }
});

async function handleScrapeAndPost(tabId) {
  if (!tabId) return;

  try {
    // Execute the scraper on the current tab
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapePartData,
    });

    const data = results?.[0]?.result;
    if (!data || !data.title) {
      chrome.runtime.sendMessage({
        action: "STATUS_UPDATE",
        status: "error",
        message: "Could not scrape product data. Make sure you are on a product page (/parts/[id]).",
      });
      return;
    }

    // Save to storage
    await chrome.storage.local.set({ scrapedPart: data });

    // Notify popup
    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      status: "scraped",
      data,
    });

    // Download images
    if (data.photos && data.photos.length > 0) {
      await handleImageDownloads(data.photos, data.title);
    }

    // Open FB Marketplace (listing = general item, not vehicle)
    chrome.tabs.create({
      url: "https://www.facebook.com/marketplace/create/listing",
      active: true,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      status: "error",
      message: "Scraping failed: " + err.message,
    });
  }
}

// This function runs in the context of the inventory page
function scrapePartData() {
  // Strategy 1: Read the hidden JSON block (most reliable)
  const jsonEl = document.getElementById("part-data");
  if (jsonEl) {
    try {
      return JSON.parse(jsonEl.textContent);
    } catch (e) {
      console.warn("Failed to parse part-data JSON", e);
    }
  }

  // Strategy 2: Fallback to DOM scraping
  const title = document.querySelector("h1")?.textContent?.trim() || "";

  // Price: look for the bold element after h1
  let price = "";
  const priceEl = document.querySelector("h1 + p, [class*='font-bold'][class*='text-primary']");
  if (priceEl) {
    price = priceEl.textContent.replace(/[^0-9.]/g, "");
  }

  // Description
  let description = "";
  const descHeading = Array.from(document.querySelectorAll("h2")).find(
    (el) => el.textContent.includes("Description")
  );
  if (descHeading) {
    const descP = descHeading.parentElement?.querySelector("p");
    if (descP) description = descP.textContent.trim();
  }

  // Images
  const photos = [];
  document.querySelectorAll("img").forEach((img) => {
    const src = img.src || img.getAttribute("src");
    if (src && src.includes("supabase") && !photos.includes(src)) {
      photos.push(src);
    }
  });

  // Condition from badge
  let condition = "used";
  const badges = document.querySelectorAll('[class*="badge"]');
  const conditionTerms = ["new", "like new", "excellent", "good", "fair", "used", "for parts"];
  badges.forEach((b) => {
    const text = b.textContent.trim().toLowerCase();
    if (conditionTerms.includes(text)) {
      condition = text.replace(" ", "_");
    }
  });

  return {
    title,
    price: parseFloat(price) || 0,
    description,
    condition,
    category: "",
    photos,
    make: "",
    model: "",
    year: "",
  };
}

// Direct post: data comes from admin dashboard, no scraping needed
async function handleDirectPost(data) {
  if (!data || !data.title) {
    console.error("[BG] DIRECT_POST: no data");
    return;
  }

  console.log("[BG] Direct posting:", data.title);

  try {
    // Save to storage (photos URLs included — content-fb.js will fetch & upload them)
    await chrome.storage.local.set({ scrapedPart: data });

    // Open FB Marketplace (listing = general item, not vehicle)
    chrome.tabs.create({
      url: "https://www.facebook.com/marketplace/create/listing",
      active: true,
    });
  } catch (err) {
    console.error("[BG] Direct post error:", err);
  }
}

async function handleImageDownloads(imageUrls, title) {
  const safeName = (title || "part").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const ext = url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || "jpg";
    const filename = `fb-upload/${safeName}_${i + 1}.${ext}`;

    try {
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false,
        conflictAction: "uniquify",
      });
    } catch (err) {
      console.error(`Failed to download image ${i + 1}:`, err);
    }
  }
}
