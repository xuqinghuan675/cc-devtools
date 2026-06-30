# Changelog

## Unreleased

- Restrict `[ACTION:save]` writes to the configured bridge write root
- Add DevTools workflow modes: Inspect, Debug, Selector, QA, and Local Data Patch
- Add local file actions for listing and reading project files inside the bridge write root
- Escape ordinary assistant HTML before rendering in the DevTools panel
- Add Python and Node regression tests plus CI checks
- Document GitHub install path, configuration, and safety model

## [0.1.0] - 2026-06-29

- Initial release
- WebSocket bridge server (Python + Node.js)
- Chrome DevTools extension (Manifest V3)
- Page context collection (URL, title, body text, DOM)
- Action system: eval, dom, dom:all, text, console, network, title, url, copy, save
- Console log interception
- Network HAR capture
- File write to disk
