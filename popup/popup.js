// Quick Index Checker — Popup Logic

// === Affiliate Config ===
const AFFILIATE = {
  rapidIndexChecker: {
    enabled: true,
    name: "Rapid Index Checker",
    url: "https://rapidindexchecker.com/?via=ada621",
    desc: "For SEO teams: check thousands of URLs for Google index status, track indexing changes, diagnose indexability issues.",
  },
  indexly: {
    enabled: true,
    name: "Indexly",
    url: "https://indexly.ai/?aff=ada",
    desc: "AI Search Visibility Platform. Track how ChatGPT, Gemini, Perplexity, Grok, Claude & AI Overviews talk about your brand.",
  },
};

// === State ===
const state = {
  currentUrl: null,
  results: [],
  isChecking: false,
  abortController: null,
};

// === DOM Ref ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === Init ===
document.addEventListener("DOMContentLoaded", async () => {
  // Load current page URL
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url && !tabs[0].url.startsWith("chrome://")) {
    state.currentUrl = tabs[0].url;
    $("#currentUrl").textContent = state.currentUrl;
  }

  // Check for pending right-click URL
  try {
    const resp = await chrome.runtime.sendMessage({ action: "getPendingUrl" });
    if (resp?.url) {
      state.currentUrl = resp.url;
      $("#currentUrl").textContent = resp.url;
      // Auto-switch to bulk tab or just show the URL
    }
  } catch (e) {
    // Ignore — service worker may not respond
  }

  // Tab switching
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      $(`#tab-${tab.dataset.tab}`).classList.add("active");
      clearResults();
    });
  });

  // Bulk input URL counter
  $("#bulkInput").addEventListener("input", updateUrlCount);

  // Check page button
  $("#checkPageBtn").addEventListener("click", checkPage);

  // Check bulk button
  $("#checkBulkBtn").addEventListener("click", checkBulk);

  // Export CSV
  $("#exportCsvBtn").addEventListener("click", exportCsv);

  // Clear results
  $("#clearResultsBtn").addEventListener("click", clearResults);

  // Settings button
  $("#settingsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // CAPTCHA dismiss
  $("#captchaDismiss").addEventListener("click", () => {
    $("#captchaNotice").classList.add("hidden");
  });
});

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
  btn.classList.add("btn-loading");
  btn.disabled = true;
  state.isChecking = true;

  try {
    const result = await checkUrl(state.currentUrl);
    state.results = [result];
    showResults("page");
    showAffiliateNudge(state.results);
  } catch (err) {
    if (err.message === "CAPTCHA") {
      showCaptchaNotice();
    } else {
      showError(err.message);
    }
  } finally {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
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
  btn.classList.add("btn-loading");
  btn.disabled = true;
  state.isChecking = true;

  // Show progress
  const progressArea = $("#progressArea");
  progressArea.classList.remove("hidden");
  updateProgress(0, urls.length);

  let captchaTriggered = false;

  for (let i = 0; i < urls.length; i++) {
    updateProgress(i, urls.length, `Checking ${i + 1}/${urls.length}...`);

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

    // Delay to avoid rate limiting
    if (i < urls.length - 1) {
      await sleep(getDelay(i));
    }
  }

  updateProgress(urls.length, urls.length, "Done");
  setTimeout(() => progressArea.classList.add("hidden"), 800);
  btn.classList.remove("btn-loading");
  btn.disabled = false;
  state.isChecking = false;

  if (state.results.length > 0) {
    showResults("bulk");
    showAffiliateNudge(state.results);
  }
}

// === Check Single URL ===
async function checkUrl(url) {
  const searchUrl = `https://www.google.com/search?q=site:${encodeURIComponent(url)}&hl=en`;

  const controller = new AbortController();
  state.abortController = controller;

  const response = await fetch(searchUrl, {
    signal: controller.signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    credentials: "omit",
  });

  const html = await response.text();

  // Detect CAPTCHA
  if (
    html.includes("unusual traffic") ||
    html.includes("captcha") ||
    html.includes("recaptcha") ||
    html.includes("g-recaptcha") ||
    response.status === 429
  ) {
    throw new Error("CAPTCHA");
  }

  // Detect "No results found"
  const noResults = html.includes("No results found for") ||
    html.includes("did not match any documents") ||
    html.includes("Your search -") && html.includes("- did not match any");

  if (noResults) {
    return { url, indexed: false };
  }

  // Try to find the URL in the results
  // Method: check if the normalized URL appears in anchor hrefs
  const normalizedUrl = normalizeUrl(url);
  const urlInResults = html.includes(normalizedUrl);

  return { url, indexed: urlInResults };
}

// === Helpers ===
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // Remove trailing slash for matching
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return u.hostname + path;
  } catch {
    return url;
  }
}

function getDelay(index) {
  // Gradually increase delay to avoid rate limiting
  // First requests: 1.5s, later: 3s
  return Math.min(1500 + index * 80, 3000);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// === Display Results ===
function showResults(mode) {
  const area = $("#resultsArea");
  area.classList.remove("hidden");

  const indexed = state.results.filter((r) => r.indexed).length;
  const notIndexed = state.results.filter((r) => !r.indexed).length;

  // Summary
  $("#resultsSummary").innerHTML = `
    <span class="summary-badge indexed">✅ ${indexed} Indexed</span>
    <span class="summary-badge not-indexed">❌ ${notIndexed} Not Indexed</span>
  `;

  // List
  const list = $("#resultsList");
  list.innerHTML = state.results
    .map(
      (r) => `
      <div class="result-item">
        <span class="status-dot ${r.indexed ? "indexed" : "not-indexed"}"></span>
        <span>${r.url} ${r.error ? `<span style="color:var(--danger)">— ${r.error}</span>` : ""}</span>
      </div>
    `
    )
    .join("");

  // Scroll to top of results
  area.scrollIntoView({ behavior: "smooth" });
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
  if (text) $("#progressText").textContent = text;
}

function showError(msg) {
  const area = $("#resultsArea");
  area.classList.remove("hidden");
  $("#resultsSummary").innerHTML = `
    <span style="color:var(--danger);font-size:12px">⚠️ ${msg}</span>
  `;
}

function showCaptchaNotice() {
  $("#captchaNotice").classList.remove("hidden");
  // Open a Google tab for user to verify
  chrome.tabs.create({ url: "https://www.google.com/search?q=test", active: true });
}

// === Affiliate Nudge ===
function showAffiliateNudge(results) {
  const notIndexed = results.filter((r) => !r.indexed && !r.error);
  const hasUnindexed = notIndexed.length > 0;

  let html = `
    <div class="affiliate-item">
      <div class="affiliate-text">AI Overviews, ChatGPT, Gemini talking about your brand? Try Indexly to track AI search visibility.</div>
      <a class="affiliate-btn" href="${AFFILIATE.indexly.url}" target="_blank" rel="noopener">${AFFILIATE.indexly.name} <svg class="affiliate-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"/><polyline points="7 7 17 7 17 17"/></svg></a>
    </div>`;

  if (hasUnindexed) {
    html = `
    <div class="affiliate-item">
      <div class="affiliate-text">Want to submit unindexed pages or monitor indexing changes? Use Rapid Index Checker for batch submission & tracking.</div>
      <a class="affiliate-btn" href="${AFFILIATE.rapidIndexChecker.url}" target="_blank" rel="noopener">${AFFILIATE.rapidIndexChecker.name} <svg class="affiliate-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"/><polyline points="7 7 17 7 17 17"/></svg></a>
    </div>
    ` + html;
  }

  const nudge = $("#affiliateNudge");
  nudge.innerHTML = html;
  nudge.classList.remove("hidden");
}

// === Export CSV ===
function exportCsv() {
  if (state.results.length === 0) return;

  const header = "URL,Status\n";
  const rows = state.results
    .map((r) => {
      const status = r.error ? "Error" : r.indexed ? "Indexed" : "Not Indexed";
      return `"${r.url}",${status}`;
    })
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `index-check-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
