// Quick Index Checker — Service Worker
// Handles: context menu, side panel, sitemap fetch proxy

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
    fetch(request.url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
