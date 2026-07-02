// Quick Index Checker — Service Worker
// Handles: context menu, side panel, sitemap fetch proxy

// Fetch with timeout + retry for sitemap imports
async function fetchWithRetry(url, retries) {
  const FETCH_TIMEOUT = 15000; // 15 seconds
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (err) {
      lastError = err;
      if (err.name === "AbortError") {
        lastError = new Error(`Request timed out after ${FETCH_TIMEOUT / 1000}s`);
      }
      // Don't retry on abort — likely a real timeout, not transient
      if (err.name === "AbortError") break;
    }
  }
  throw lastError;
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "checkIndex",
    title: "Check if indexed on Google",
    contexts: ["link", "page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  chrome.storage.local.set({ pendingCheckUrl: url }, () => {
    chrome.sidePanel.open({ windowId: tab.windowId });
  });
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Get pending URL from context menu
  if (request.action === "getPendingUrl") {
    chrome.storage.local.get("pendingCheckUrl", (data) => {
      const url = data.pendingCheckUrl || null;
      if (url) chrome.storage.local.remove("pendingCheckUrl");
      sendResponse({ url });
    });
    return true;
  }

  // Proxy fetch for sitemap (bypasses CORS in side panel)
  if (request.action === "fetchSitemap") {
    fetchWithRetry(request.url, 2)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
