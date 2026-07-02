# Changelog

## Unreleased

- Mark the first Workbench milestone as preliminarily complete across documentation
- Add Workbench tabs: Chat, Evidence, Recorder, Visual, Patch, Tests, Trust, and Recipes
- Add Safety Kernel helpers, TrustPolicy, Trust Mode permission matrix, and shared Send Preview
- Add Evidence Board with structured EvidenceItem records, filtering, selection, copy, and redacted send summary
- Add Bug Flight Recorder with bounded ring buffer and BugBundle generation
- Add copy-only Playwright test draft generation from selected evidence
- Add conservative Patch Transaction flow with backup, diff preview, apply, verify, and rollback states
- Add DOM-first Visual diagnostics for selector visibility, clickability, style, overflow, and coverage
- Add manual Recipes and Project Memory import/export with schema validation
- Add updated README screenshots including Workbench overview
- Restrict `[ACTION:save]` writes to the configured bridge write root
- Add DevTools workflow modes: Inspect, Debug, Selector, QA, Local Data Patch, and Frontend Loop
- Add local file actions for listing and reading project files inside the bridge write root
- Add project scanning for frontend framework, bundler, scripts, dependencies, and entry files
- Add page interaction actions for clicking, typing, and pressing keys from the DevTools chat
- Add a bundled `examples/country-selector-loop` demo for page -> project scan -> file write -> browser verification
- Add `cc-devtools-demo --live` to start the Frontend Loop demo page and bridge with one command
- Replace the Windows installer with a two-step flow that installs the Python bridge, clears stale port `9876` listeners, starts the bridge, and opens Chrome extension setup
- Localize DevTools panel controls for Chinese browsers
- Accept absolute file-list patterns inside the configured write root
- Automatically attach local project context to Frontend Loop chat payloads
- Polish the DevTools panel and bundled demo UI for clearer onboarding and recordings
- Escape ordinary assistant HTML before rendering in the DevTools panel
- Add Python and Node regression tests plus CI checks
- Document GitHub install path, configuration, and safety model
- Rewrite README and README_CN for clearer open-source positioning and onboarding
- Add quickstart, use-case, security, code-of-conduct, PR template, and GitHub growth docs

## [0.1.0] - 2026-06-29

- Initial release
- WebSocket bridge server (Python + Node.js)
- Chrome DevTools extension (Manifest V3)
- Page context collection (URL, title, body text, DOM)
- Action system: eval, dom, dom:all, text, console, network, title, url, copy, save
- Console log interception
- Network HAR capture
- File write to disk
