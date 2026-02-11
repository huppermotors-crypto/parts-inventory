// ============================================
// Content Script: Inventory Site Scraper
// Runs on /parts/* pages
// ============================================

// This script makes the page "scrapeable" from the popup/background.
// The actual scraping logic is in background.js (executed via chrome.scripting).
// This script adds a visual indicator that the extension is active.

(function () {
  // Add a small badge to indicate extension is active
  const badge = document.createElement("div");
  badge.id = "ext-scraper-badge";
  badge.innerHTML = "🔧 FB Poster Ready";
  badge.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #2563eb;
    color: white;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, sans-serif;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    cursor: pointer;
    transition: opacity 0.3s;
  `;

  badge.addEventListener("click", () => {
    badge.style.opacity = "0";
    setTimeout(() => badge.remove(), 300);
  });

  // Remove after 5 seconds
  setTimeout(() => {
    if (badge.parentElement) {
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 300);
    }
  }, 5000);

  document.body.appendChild(badge);
})();
