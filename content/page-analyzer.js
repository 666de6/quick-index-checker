// Quick Index Checker — Page Analyzer (injected content script)
// Runs in the context of the inspected page. Must be self-contained.

(function () {
  const result = {
    url: window.location.href,
    title: document.title || "",
    noindex: false,
    nofollow: false,
    outboundLinks: [],
  };

  // --- Meta robots detection ---
  const metaRobots = document.querySelector('meta[name="robots"]');
  const metaGooglebot = document.querySelector('meta[name="googlebot"]');

  for (const meta of [metaRobots, metaGooglebot]) {
    if (!meta) continue;
    const content = (meta.getAttribute("content") || "").toLowerCase();
    if (content.includes("noindex")) result.noindex = true;
    if (content.includes("nofollow")) result.nofollow = true;
  }

  // --- Outbound links ---
  const currentOrigin = window.location.origin;
  const seen = new Set();

  document.querySelectorAll('a[href]').forEach((a) => {
    let href;
    try {
      href = new URL(a.getAttribute("href"), window.location.href).href;
    } catch {
      return; // invalid URL
    }

    // Only external links (different origin) with http/https
    if (!href.startsWith("http")) return;
    if (new URL(href).origin === currentOrigin) return;
    if (seen.has(href)) return;

    seen.add(href);
    result.outboundLinks.push({
      url: href,
      text: (a.textContent || "").trim().slice(0, 80),
    });
  });

  return result;
})();
