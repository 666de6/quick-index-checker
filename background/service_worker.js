// Quick Index Checker — Service Worker
// Handles right-click context menu

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

  // Store URL for popup to pick up
  chrome.storage.local.set({ pendingCheckUrl: url }, () => {
    // Open popup programmatically — best we can do is notify
    chrome.action.openPopup();
  });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPendingUrl") {
    chrome.storage.local.get("pendingCheckUrl", (data) => {
      const url = data.pendingCheckUrl || null;
      if (url) {
        chrome.storage.local.remove("pendingCheckUrl");
      }
      sendResponse({ url });
    });
    return true; // Keep channel open for async response
  }
});
