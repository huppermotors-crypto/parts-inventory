// ============================================
// Content Script: Admin Dashboard
// Listens for "Post to FB" and "Post to eBay" button clicks
// ============================================

(function () {
  "use strict";

  console.log("[Parts Extension] Admin content script loaded");

  // Send message to background with retry (MV3 service worker may be asleep)
  function sendToBackground(message, retries = 3) {
    return new Promise((resolve, reject) => {
      function attempt(n) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              `[Parts Extension] Attempt ${4 - n}/3 failed:`,
              chrome.runtime.lastError.message
            );
            if (n > 1) {
              setTimeout(() => attempt(n - 1), 500);
            } else {
              reject(new Error(chrome.runtime.lastError.message));
            }
            return;
          }
          resolve(response);
        });
      }
      attempt(retries);
    });
  }

  // Listen for custom event from the dashboard "Post to FB" button
  window.addEventListener("fb-post-part", async (event) => {
    const partData = event.detail;
    if (!partData || !partData.title) {
      console.warn("[Parts Extension] No part data in fb event");
      return;
    }

    console.log("[Parts Extension] FB post:", partData.title);

    try {
      const response = await sendToBackground({
        action: "DIRECT_POST",
        data: partData,
      });
      console.log("[Parts Extension] Background response:", response);
      showNotification("Opening Facebook Marketplace...", "success");
    } catch (err) {
      console.error("[Parts Extension] FB error:", err.message);
      showNotification(
        "Extension error: " + err.message + ". Try reloading the page.",
        "error"
      );
    }
  });

  // Listen for custom event from the dashboard "Post to eBay" button
  window.addEventListener("ebay-post-part", async (event) => {
    const partData = event.detail;
    if (!partData || !partData.title) {
      console.warn("[Parts Extension] No part data in ebay event");
      return;
    }

    console.log("[Parts Extension] eBay post:", partData.title);

    try {
      const response = await sendToBackground({
        action: "DIRECT_POST_EBAY",
        data: partData,
      });
      console.log("[Parts Extension] Background response:", response);
      showNotification("Opening eBay Create Listing...", "ebay");
    } catch (err) {
      console.error("[Parts Extension] eBay error:", err.message);
      showNotification(
        "Extension error: " + err.message + ". Try reloading the page.",
        "error"
      );
    }
  });

  // Visual notification on the page
  function showNotification(message, type) {
    const existing = document.getElementById("parts-ext-notification");
    if (existing) existing.remove();

    const colors = {
      success: "background: #1877f2; color: white;",
      ebay: "background: #e53238; color: white;",
      error: "background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;",
    };

    const el = document.createElement("div");
    el.id = "parts-ext-notification";
    el.textContent = message;
    el.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, sans-serif;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: opacity 0.3s, transform 0.3s;
      transform: translateY(0);
      max-width: 400px;
      ${colors[type] || colors.success}
    `;

    document.body.appendChild(el);

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }
})();
