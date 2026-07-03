# Quick Index Checker 🥝

Free Chrome extension to check if URLs are indexed by Google — in one click.

## Features

- **Side Panel** — Click the icon, drawer slides from the right
- **Single Check** — Check current page with one click
- **Bulk Check** — Paste multiple URLs, check all at once with progress bar
- **Sitemap Import** — Paste any sitemap.xml URL to auto-parse and populate the list
- **Noindex Detection** — Auto-detects `<meta name="robots" content="noindex">` on current page
- **Right-Click** — "Check if indexed on Google" on any link or page
- **History** — Past checks saved locally with timestamps, re-check any URL
- **CSV Export** — Export results with URL + status

## Privacy

Zero data collection. Everything runs client-side.

All checks go directly from your browser to Google — we never see your URLs. No analytics, no tracking, no servers.

[Full Privacy Policy](https://666de6.github.io/quick-index-checker/privacy/privacy.html)

## Install

[Install Chrome extension ](https://chromewebstore.google.com/detail/quick-index-checker/cgffpijloblophcnacabhpfgboecgobl)

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read current page URL |
| `contextMenus` | Add right-click option |
| `storage` | Local-only history |
| `scripting` | Detect noindex tags |
| `sidePanel` | Side panel UI |
| `google.com` | Query Google to check indexing |

## License

MIT
