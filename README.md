# Quick Index Checker 🥝

Free Chrome extension to check if URLs are indexed by Google. Opens as a sleek side panel drawer from the right.

## Features

| | |
|---|---|
| **Side Panel** | Click icon → drawer slides from right |
| **Right-Click** | "Check if indexed on Google" on any link/page |
| **Single Check** | Check current page with one click |
| **Bulk Check** | Paste multiple URLs, check all at once |
| **Noindex Detection** | Auto-detects `<meta name="robots" content="noindex">` on current page |
| **Sitemap Import** | Paste any sitemap.xml URL → auto-parse & populate list |
| **History** | Past checks saved locally with timestamps, re-check any URL |
| **CSV Export** | Export results with URL + status |
| **CAPTCHA** | Auto-detects Google verification, opens tab for user |
| **Affiliate Nudge** | Prompts index-fixing tools only when unindexed URLs found |

## Project Structure

```
quick-index-checker/
├── manifest.json              → V3 manifest (sidePanel + scripting)
├── icons/                     → Logo PNGs (16/32/48/128/256/512)
├── sidepanel/
│   ├── sidepanel.html         → 3-tab UI (Page / Bulk / History)
│   ├── sidepanel.css          → Styles
│   └── sidepanel.js           → All logic
├── background/
│   └── service_worker.js      → Context menu + sidePanel + sitemap proxy
├── options/
│   └── options.html           → Settings / privacy
├── privacy/
│   └── privacy.html           → Privacy policy (GitHub Pages)
└── popup/                     → Deprecated (kept for reference)
```

## Design Tokens

- Primary: `#767F9E`
- Secondary: `#DAA464`
- Tertiary: `#DEC384`
- Background: `#faf8f2`

## Dev

No build step. No frameworks. Just HTML/CSS/JS.

To load in Chrome:
1. `chrome://extensions` → Developer mode
2. "Load unpacked" → select `~/Desktop/quick-index-checker` (symlink already created)
3. Click extension icon → side panel opens

## Test Checklist

- [ ] Side panel opens on icon click (right-side drawer)
- [ ] Current page URL displayed, refresh button works on navigation
- [ ] Noindex badge appears on pages with `<meta name="robots" content="noindex">`
- [ ] Single page check shows correct indexed/not-indexed status
- [ ] Bulk paste multiple URLs → all checked with progress bar
- [ ] Sitemap URL import → URLs populate textarea
- [ ] Results: 0-count badges not shown (only non-zero counts)
- [ ] CSV export downloads correctly
- [ ] History tab shows past results with timestamps
- [ ] Re-check button in history works
- [ ] CAPTCHA detection triggers notice + opens tab
- [ ] Affiliate nudge shows when unindexed URLs found
- [ ] Right-click context menu on any link
- [ ] Settings gear icon opens styled options page
- [ ] Privacy page styled consistently

## Affiliate Setup

```js
// In sidepanel/sidepanel.js, replace YOUR_ID:
indexMachine: { url: "https://indexmachine.co/?ref=YOUR_ID" }
indexly: { url: "https://indexly.ai/?ref=YOUR_ID" }
```

## Privacy

Zero data collection. Everything runs client-side.
Privacy Policy: https://666de6.github.io/quick-index-checker/privacy/privacy.html
