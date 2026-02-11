// ============================================
// Content Script: Admin Dashboard
// Listens for "Post to FB" button clicks
// ============================================

(function () {
  "use strict";

  console.log("[FB Extension] Admin content script loaded");

  // Listen for custom event from the dashboard "Post to FB" button
  window.addEventListener("fb-post-part", (event) => {
    const partData = event.detail;
    if (!partData || !partData.title) {
      console.warn("[FB Extension] No part data in event");
      return;
    }

    console.log("[FB Extension] Received part data:", partData.title);

    // Send to background script for processing
    chrome.runtime.sendMessage(
      {
        action: "DIRECT_POST",
        data: partData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[FB Extension] Error:", chrome.runtime.lastError.message);
          showNotification("❌ Extension error. Make sure the extension is installed and enabled.", "error");
          return;
        }
        console.log("[FB Extension] Background response:", response);
        showNotification("✅ Opening Facebook Marketplace...", "success");
      }
    );
  });

  // Also watch for data attribute changes (fallback)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-part") {
        const el = mutation.target;
        const data = el.getAttribute("data-part");
        if (data) {
          try {
            const partData = JSON.parse(data);
            // Clear it so it doesn't fire again
            el.removeAttribute("data-part");

            chrome.runtime.sendMessage({
              action: "DIRECT_POST",
              data: partData,
            });
          } catch (e) {
            console.error("[FB Extension] Failed to parse part data:", e);
          }
        }
      }
    }
  });

  // Observe the body for the hidden element
  const checkForElement = () => {
    const el = document.getElementById("fb-post-part-data");
    if (el) {
      observer.observe(el, { attributes: true });
    }
  };

  // Check now and periodically (SPA might add it later)
  checkForElement();
  const bodyObserver = new MutationObserver(() => checkForElement());
  bodyObserver.observe(document.body, { childList: true, subtree: true });

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
    }, 3000);
  }
})();
