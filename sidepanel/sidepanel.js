// Quick Index Checker — Side Panel Logic
// Page analysis | Bulk check | Sitemap import | History

// === Affiliate Config ===
const AFFILIATE = {
  indexMachine: {
    enabled: false,
    name: "IndexMachine",
    url: "https://indexmachine.co/?ref=YOUR_ID",
    desc: "Bulk check + auto-index your URLs — one-time $12.50 lifetime deal",
  },
  indexly: {
    enabled: false,
    name: "Indexly",
    url: "https://indexly.ai/?ref=YOUR_ID",
    desc: "Monitor 1000s of URLs, get alerts when pages drop from index",
  },
};

// === State ===
const state = {
  currentUrl: null,
  currentTabId: null,
  results: [],
  isChecking: false,
};

// === DOM ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === Init ===
document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentPage();

  // Check for pending right-click URL
  try {
    const resp = await chrome.runtime.sendMessage({ action: "getPendingUrl" });
    if (resp?.url) {
      state.currentUrl = resp.url;
      $("#currentUrl").textContent = resp.url;
    }
  } catch (e) { /* ignore */ }

  // Tab switching
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Bulk URL counter
  $("#bulkInput").addEventListener("input", updateUrlCount);

  // Buttons
  $("#checkPageBtn").addEventListener("click", checkPage);
  $("#checkBulkBtn").addEventListener("click", checkBulk);
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#clearResultsBtn").addEventListener("click", clearResults);
  $("#captchaDismiss").addEventListener("click", () => $("#captchaNotice").classList.add("hidden"));
  $("#importSitemapBtn").addEventListener("click", importSitemap);
  $("#clearHistoryBtn").addEventListener("click", clearHistory);
  $("#refreshPageBtn").addEventListener("click", refreshPage);

  // Settings
  $("#settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});

// === Tab Switching ===
function switchTab(tabName) {
  $$(".tab").forEach((t) => t.classList.remove("active"));
  $$(".tab-panel").forEach((c) => c.classList.remove("active"));
  $(`.tab[data-tab="${tabName}"]`).classList.add("active");
  $(`#tab-${tabName}`).classList.add("active");
  clearResults();

  if (tabName === "history") {
    loadHistory();
  }
}

// === Load/Reresh Current Page Info ===
async function loadCurrentPage() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;
  state.currentTabId = tabs[0].id;
  if (tabs[0].url && !tabs[0].url.startsWith("chrome://")) {
    state.currentUrl = tabs[0].url;
    $("#currentUrl").textContent = state.currentUrl;
    analyzePage(state.currentTabId);
  }
}

async function refreshPage() {
  const btn = $("#refreshPageBtn");
  btn.classList.add("spinning");
  try {
    await loadCurrentPage();
    // Brief visual feedback
    btn.style.color = "var(--success)";
    setTimeout(() => {
      btn.style.color = "";
      btn.classList.remove("spinning");
    }, 600);
  } catch (e) {
    btn.classList.remove("spinning");
    btn.style.color = "var(--danger)";
    setTimeout(() => { btn.style.color = ""; }, 800);
  }
}

// === Page Analysis (noindex detection via content script) ===
async function analyzePage(tabId) {
  if (!tabId) return;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const metas = document.querySelectorAll('meta[name="robots"], meta[name="googlebot"]');
        let noindex = false;
        metas.forEach((m) => {
          const c = (m.getAttribute("content") || "").toLowerCase();
          if (c.includes("noindex")) noindex = true;
        });
        return { noindex };
      },
    });

    if (results && results[0]?.result) {
      const analysis = $("#pageAnalysis");
      analysis.classList.remove("hidden");
      if (results[0].result.noindex) {
        $("#noindexBadge").innerHTML = `<span class="meta-badge warn">⚠ This page has a noindex tag</span>`;
      } else {
        $("#noindexBadge").innerHTML = `<span class="meta-badge no">✓ Indexable (no noindex tag)</span>`;
      }
    }
  } catch (e) {
    console.debug("Page analysis skipped:", e.message);
  }
}

// === URL Counter ===
function updateUrlCount() {
  const text = $("#bulkInput").value.trim();
  const urls = text ? text.split("\n").filter((u) => u.trim()) : [];
  $("#urlCount").textContent = `${urls.length} URL${urls.length !== 1 ? "s" : ""}`;
}

// === Check Single Page ===
async function checkPage() {
  if (state.isChecking || !state.currentUrl) return;
  state.results = [];
  const btn = $("#checkPageBtn");
  setLoading(btn, true);
  state.isChecking = true;
  clearResults();

  try {
    const result = await checkUrl(state.currentUrl);
    state.results = [result];
    showResults("page");
    saveToHistory(state.results, "page");
    showAffiliateNudge(state.results);
  } catch (err) {
    if (err.message === "CAPTCHA") {
      showCaptchaNotice();
    } else {
      showError(err.message);
    }
  } finally {
    setLoading(btn, false);
    state.isChecking = false;
  }
}

// === Check Bulk URLs ===
async function checkBulk() {
  if (state.isChecking) return;

  const text = $("#bulkInput").value.trim();
  if (!text) return;

  const urls = text
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u && (u.startsWith("http://") || u.startsWith("https://")));

  if (urls.length === 0) {
    showError("No valid URLs found. URLs must start with http:// or https://");
    return;
  }

  state.results = [];
  const btn = $("#checkBulkBtn");
  setLoading(btn, true);
  state.isChecking = true;
  clearResults();

  const progress = $("#progressArea");
  progress.classList.remove("hidden");
  updateProgress(0, urls.length);

  let captchaTriggered = false;

  for (let i = 0; i < urls.length; i++) {
    updateProgress(i, urls.length, `Checking ${i + 1} of ${urls.length}…`);

    try {
      const result = await checkUrl(urls[i]);
      state.results.push(result);
    } catch (err) {
      if (err.message === "CAPTCHA") {
        captchaTriggered = true;
        showCaptchaNotice();
        break;
      }
      state.results.push({ url: urls[i], indexed: false, error: err.message });
    }

    if (i < urls.length - 1 && !captchaTriggered) {
      await sleep(getDelay(i));
    }
  }

  updateProgress(urls.length, urls.length, "Done");
  setTimeout(() => progress.classList.add("hidden"), 600);
  setLoading(btn, false);
  state.isChecking = false;

  if (state.results.length > 0) {
    showResults("bulk");
    saveToHistory(state.results, "bulk");
    showAffiliateNudge(state.results);
  }
}

// === Check Single URL (site: search via gbv=1 server-rendered HTML) ===
// gbv=1 forces Google to return server-rendered HTML (no JS required).
// This is critical: without gbv=1, fetch() gets a JS skeleton with no result text.
//
// Detection logic (layered, most reliable first):
//   1. Explicit "no results" text → NOT indexed
//   2. Positive result indicators (id="search", class="g", etc.) → indexed
//   3. Cite tag contains URL → indexed
//   4. Fallback: if no "no results" text found, lean indexed
async function checkUrl(url) {
  const searchUrl = `https://www.google.com/search?q=site:${encodeURIComponent(url)}&hl=en&gbv=1`;

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    credentials: "omit",
  });

  const html = await response.text();

  // CAPTCHA detection
  if (
    html.includes("unusual traffic") ||
    html.includes("captcha") ||
    html.includes("recaptcha") ||
    html.includes("g-recaptcha") ||
    response.status === 429
  ) {
    throw new Error("CAPTCHA");
  }

  // Layer 1: Explicit "no results" patterns
  // Google displays these in the page body when nothing is indexed
  const noResults =
    html.includes("did not match any documents") ||
    html.includes("No results found for") ||
    html.includes("did not match any") ||
    (html.includes("Your search") && html.includes("did not match"));

  if (noResults) {
    return { url, indexed: false };
  }

  // Layer 2: Positive indicators — Google result page structure
  const hasResults =
    html.includes('id="search"') ||
    html.includes('class="g "') ||
    html.includes('id="rso"') ||
    html.includes('id="result-stats"') ||
    html.includes('<h3 class="') ||
    html.includes('data-hveid');

  if (hasResults) {
    return { url, indexed: true };
  }

  // Layer 3: Check if URL appears in cite/result area
  // This catches cases where Google shows results but without the standard DOM structure
  const norm = normalizeUrl(url);
  if (/<cite[^>]*>/i.test(html)) {
    // Has cite elements — check if our URL is in any of them
    const citeRe = /<cite[^>]*>([\s\S]*?)<\/cite>/gi;
    let m;
    while ((m = citeRe.exec(html)) !== null) {
      const t = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, "").toLowerCase();
      if (t.includes(norm)) return { url, indexed: true };
    }
  }

  // Layer 4: Fallback — if no "no results" patterns, assume indexed
  // The site: operator only returns a page with content for indexed URLs
  return { url, indexed: true };
}

// === Sitemap Import (via background SW to bypass CORS) ===
async function importSitemap() {
  const url = $("#sitemapUrl").value.trim();
  const hint = $("#sitemapHint");

  if (!url) {
    hint.textContent = "Enter a sitemap URL";
    hint.className = "hint error";
    return;
  }

  // Auto-prepend https:// if no protocol
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  hint.textContent = "Fetching sitemap…";
  hint.className = "hint";

  try {
    // Proxy through background service worker to avoid CORS
    const resp = await chrome.runtime.sendMessage({
      action: "fetchSitemap",
      url,
    });

    if (!resp.ok) {
      throw new Error(resp.error || "Failed to fetch");
    }

    const urls = parseSitemapXml(resp.text);

    if (urls.length === 0) {
      hint.textContent = "No URLs found in sitemap";
      hint.className = "hint error";
      return;
    }

    // Replace bulk textarea with imported URLs (don't append to old ones)
    $("#bulkInput").value = urls.join("\n");
    updateUrlCount();
    hint.textContent = `✓ Imported ${urls.length} URLs`;
    hint.className = "hint success";
  } catch (e) {
    hint.textContent = `Import failed: ${e.message}`;
    hint.className = "hint error";
  }
}

function parseSitemapXml(xml) {
  const urls = [];
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.push(url);
    }
  }
  return [...new Set(urls)]; // deduplicate
}

// === History ===
const HISTORY_KEY = "qic_history";
const MAX_HISTORY = 200;

async function saveToHistory(results, source) {
  const entries = results.map((r) => ({
    url: r.url,
    indexed: r.indexed,
    source,
    timestamp: Date.now(),
  }));

  const stored = await chrome.storage.local.get(HISTORY_KEY);
  let history = stored[HISTORY_KEY] || [];
  history = [...entries, ...history].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function loadHistory() {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] || [];
  const list = $("#historyList");

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>No checks yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = history
    .map(
      (h) => `
      <div class="history-item">
        <span class="history-status ${h.indexed ? "indexed" : "not-indexed"}"></span>
        <div class="history-info">
          <div class="history-url" title="${escapeAttr(h.url)}">${escapeHtml(h.url)}</div>
          <div class="history-meta">
            <span>${h.indexed ? "✓ Indexed" : "✗ Not indexed"}</span>
            <span class="history-source">${h.source}</span>
            <span>${formatTime(h.timestamp)}</span>
          </div>
        </div>
        <div class="history-action">
          <button class="btn-icon btn-icon-sm recheck-btn" data-url="${escapeAttr(h.url)}" title="Re-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
        </div>
      </div>
    `
    )
    .join("");

  list.querySelectorAll(".recheck-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.dataset.url;
      $("#bulkInput").value = url;
      updateUrlCount();
      switchTab("bulk");
      setTimeout(() => checkBulk(), 200);
    });
  });
}

async function clearHistory() {
  await chrome.storage.local.remove(HISTORY_KEY);
  loadHistory();
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// === Helpers ===
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return (u.hostname + path).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function getDelay(index) {
  return Math.min(1500 + index * 80, 3000);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add("btn-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

// === Display Results ===
function showResults(source) {
  const area = $("#resultsArea");
  area.classList.remove("hidden");

  const indexed = state.results.filter((r) => r.indexed).length;
  const notIndexed = state.results.filter((r) => !r.indexed && !r.error).length;

  // Only show badges for non-zero counts
  let summaryHtml = "";
  if (indexed > 0) {
    summaryHtml += `<span class="badge badge-success">✓ ${indexed} Indexed</span>`;
  }
  if (notIndexed > 0) {
    summaryHtml += `<span class="badge badge-danger">✗ ${notIndexed} Not Indexed</span>`;
  }
  $("#resultsSummary").innerHTML = summaryHtml;

  $("#resultsList").innerHTML = state.results
    .map(
      (r) => `
      <div class="result-item">
        <span class="status-indicator ${r.indexed ? "indexed" : "not-indexed"}"></span>
        <span class="result-url">${escapeHtml(r.url)}</span>
        ${r.error ? `<span class="result-error">— ${escapeHtml(r.error)}</span>` : ""}
      </div>
    `
    )
    .join("");
}

function showError(msg) {
  const area = $("#resultsArea");
  area.classList.remove("hidden");
  $("#resultsSummary").innerHTML = "";
  $("#resultsList").innerHTML = `
    <div class="result-item" style="color:var(--danger);font-weight:500">
      ⚠ ${escapeHtml(msg)}
    </div>
  `;
}

function clearResults() {
  state.results = [];
  $("#resultsArea").classList.add("hidden");
  $("#resultsList").innerHTML = "";
  $("#resultsSummary").innerHTML = "";
  $("#affiliateNudge").classList.add("hidden");
  $("#captchaNotice").classList.add("hidden");
  $("#progressArea").classList.add("hidden");
}

function updateProgress(current, total, text) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  $("#progressFill").style.width = `${pct}%`;
  $("#progressCount").textContent = `${current}/${total}`;
  if (text) $("#progressLabel").textContent = text;
}

function showCaptchaNotice() {
  $("#captchaNotice").classList.remove("hidden");
  // Open Google in a new tab so user can solve CAPTCHA there.
  // Once solved, the browser session cookie allows future requests.
  chrome.tabs.create({ url: "https://www.google.com/", active: true });
}

// === Affiliate Nudge ===
function showAffiliateNudge(results) {
  const notIndexed = results.filter((r) => !r.indexed && !r.error);
  if (notIndexed.length === 0) return;

  let offer;
  if (notIndexed.length >= 5) {
    offer = AFFILIATE.indexly;
  } else {
    offer = AFFILIATE.indexMachine;
  }

  if (!offer || !offer.enabled) return;

  const nudge = $("#affiliateNudge");
  nudge.classList.remove("hidden");
  nudge.innerHTML = `
    ⚡ <strong>${notIndexed.length}</strong> URL${notIndexed.length > 1 ? "s" : ""} not indexed.
    <a href="${offer.url}" target="_blank">${offer.name}</a> — ${offer.desc}
  `;
}

// === Export CSV ===
function exportCsv() {
  if (state.results.length === 0) return;

  const header = "URL,Status\n";
  const rows = state.results
    .map((r) => {
      const status = r.error ? "Error" : r.indexed ? "Indexed" : "Not Indexed";
      return `"${r.url.replace(/"/g, '""')}",${status}`;
    })
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `index-check-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// === Escape helpers ===
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
