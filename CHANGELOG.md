# Changelog

## v1.0.0 — 2026-07-01

### Features
- Side panel UI (3 tabs: Page / Bulk / History)
- Single page index check via `site:` search
- Bulk URL check with live progress bar and waterfall results
- Sitemap XML import (paste URL → auto-parse → populate list)
- Right-click context menu: "Check if indexed on Google"
- CAPTCHA detection with progress-saving resume flow
- Check history stored locally with timestamps and re-check
- CSV export (URL + indexed status)
- Settings page with privacy policy link
- No data collection — 100% client-side

### Architecture
- Manifest V3, side panel as primary UI
- Tab-based index detection (real Chrome tab reads rendered Google DOM)
- Background service worker for context menu + sitemap proxy
- Module scripts, no build step, zero dependencies
