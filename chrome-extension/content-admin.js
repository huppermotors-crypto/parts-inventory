// ============================================
// Content Script: Admin Dashboard
// Listens for "Post to FB" button clicks
// ============================================

(function () {
  "use strict";

  console.log("[FB Extension] Admin content script loaded");

  // Send message to background with retry (MV3 service worker may be asleep)
  function sendToBackground(message, retries = 3) {
    return new Promise((resolve, reject) => {
      function attempt(n) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              `[FB Extension] Attempt ${4 - n}/3 failed:`,
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
      console.warn("[FB Extension] No part data in event");
      return;
    }

    console.log("[FB Extension] Received part data:", partData.title);

    try {
      const response = await sendToBackground({
        action: "DIRECT_POST",
        data: partData,
      });
      console.log("[FB Extension] Background response:", response);
      showNotification("✅ Opening Facebook Marketplace...", "success");
    } catch (err) {
      console.error("[FB Extension] Error:", err.message);
      showNotification(
        "❌ Extension error: " + err.message + ". Try reloading the page.",
        "error"
      );
    }
  });

  // Visual notification on the page
  function showNotification(message, type) {
    const existing = document.getElementById("fb-ext-notification");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "fb-ext-notification";
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
      ${type === "success"
        ? "background: #1877f2; color: white;"
        : "background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;"
      }
    `;

    document.body.appendChild(el);

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }
})();
