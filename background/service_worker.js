// Quick Index Checker — Service Worker
// Handles: context menu, side panel, sitemap fetch proxy
// host_permissions: https://*/* allows fetch() on all HTTPS origins without CORS

// Fetch sitemap with timeout
async function fetchSitemap(url) {
  const TIMEOUT = 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
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

  // Proxy fetch for sitemap — CORS bypassed via host_permissions: https://*/*
  if (request.action === "fetchSitemap") {
    fetchSitemap(request.url)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: err.message || "Fetch failed" }));
    return true;
  }
});
