# Quick Index Checker 🥝

Free Chrome extension to check if URLs are indexed by Google.

## V1 Features

- ✅ Right-click → "Check if indexed on Google"
- ✅ Popup: check current page with one click
- ✅ Bulk check mode: paste multiple URLs, check all at once
- ✅ Results grouped: Indexed ✅ / Not Indexed ❌
- ✅ CSV export
- ✅ CAPTCHA detection (pauses and guides user through verification)
- ✅ Contextual affiliate nudges (only when unindexed URLs detected)
- ✅ Beautiful UI with custom color scheme

## V2 (Planned)

- Sitemap.xml import (client-side parsing)
- Check history (localStorage)
- Outbound links auto-detect
- Noindex/nofollow meta detection

## Project Structure

```
extension/           → Chrome extension package
├── manifest.json    → V3 manifest
├── icons/           → Logo (Ada prepares these)
├── popup/
│   ├── popup.html   → Main popup UI
│   ├── popup.css    → Styles
│   └── popup.js     → Logic
├── background/
│   └── service_worker.js → Right-click menu
├── options/
│   └── options.html → Settings page
└── privacy/
    └── privacy.html → Privacy policy (host on GitHub Pages)
```

## Design Tokens

- Primary: #767F9E
- Secondary: #DAA464
- Tertiary: #DEC384
- Background: #E8DDB4

## Affiliate Setup

Before release, update `popup/popup.js`:

```js
// Replace YOUR_ID with your actual affiliate IDs
indexMachine: { url: "https://indexmachine.co/?ref=YOUR_ID" }
indexly: { url: "https://indexly.ai/?ref=YOUR_ID" }
```

## Dev

No build step. No frameworks. Just HTML/CSS/JS.

To load unpacked in Chrome:
1. Open `chrome://extensions`
2. Enable Developer mode
3. "Load unpacked" → select `extension/` folder

## Privacy

Zero data collection. Everything runs client-side. See `privacy/privacy.html`.
