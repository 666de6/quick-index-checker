// Quick Index Checker — Service Worker
// Handles: context menu, side panel, sitemap fetch proxy

// Fetch sitemap by opening it in a hidden tab and reading the DOM.
// This bypasses CORS entirely — same approach as checkUrl.
// Chrome renders XML with a viewer; we read the raw source element.
function fetchSitemapViaTab(url) {
  const TAB_TIMEOUT = 20000;

  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.remove(tab.id).catch(() => {});
        reject(new Error("Sitemap load timed out"));
      }, TAB_TIMEOUT);

      const listener = (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== "complete") return;
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);

        // Brief wait for Chrome's XML viewer to render
        setTimeout(async () => {
          if (settled) return;
          settled = true;

          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                // Chrome XML viewer stores raw source in a hidden div
                const src = document.getElementById("webkit-xml-viewer-source-xml");
                if (src?.textContent?.trim()) return src.textContent.trim();
                // Fallback: plain text / pre element
                const pre = document.querySelector("pre");
                if (pre?.textContent?.trim()) return pre.textContent.trim();
                // Last resort: body text (loses tags but might still have URLs)
                return document.body?.innerText || "";
              },
            });

            await chrome.tabs.remove(tab.id).catch(() => {});
            const text = results[0]?.result || "";
            if (!text) {
              reject(new Error("Could not read sitemap content"));
            } else {
              resolve(text);
            }
          } catch (e) {
            await chrome.tabs.remove(tab.id).catch(() => {});
            reject(new Error(e.message || "Failed to read sitemap"));
          }
        }, 800); // 800ms for XML viewer to render
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  });
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
    fetchSitemapViaTab(request.url)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: err.message || "Fetch failed" }));
    return true;
  }
});
