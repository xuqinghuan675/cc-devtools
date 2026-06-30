# Contributing

## Setup

```bash
git clone https://github.com/xuqinghuan675/cc-devtools.git
cd cc-devtools
pip install -e .
```

## Structure

```
cc_devtools/    Python package (bridge server + CLI)
extension/      Chrome DevTools extension
bridge/         Node.js alternative bridge
tests/          Python and Node regression tests
docs/           User-facing docs and growth checklist
```

## Testing the Extension

1. Start the bridge: `cc-devtools`
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `extension/`
3. Open any page, F12 → Claude Code tab

## Automated Checks

```bash
python -m unittest discover -s tests -p "test_*.py"
node --test tests\bridge_safety.test.mjs tests\bridge_workflows.test.mjs tests\bridge_file_actions.test.mjs tests\bridge_project_scan.test.mjs tests\panel_parse_actions.test.mjs tests\panel_payload.test.mjs tests\panel_workflow_options.test.mjs
node --check bridge\server.js
node --check bridge\safety.js
node --check bridge\workflows.js
node --check bridge\file-actions.js
node --check bridge\project-scan.js
node --check cc_devtools\extension\panel\panel.js
node --check extension\panel\panel.js
node --check cc_devtools\demo\country-selector-loop\app.js
node --check cc_devtools\demo\country-selector-loop\reset-countries.mjs
node --check examples\country-selector-loop\app.js
node --check examples\country-selector-loop\reset-countries.mjs
node --check scripts\generate-demo-assets.mjs
node scripts\generate-demo-assets.mjs
```

Use `/` paths instead of `\` on macOS/Linux.

The Python test suite also checks the README demo asset and `docs/DEMO_SCRIPT.md`; update those tests when changing the public demo narrative.

## Documentation Changes

- Keep the README focused on the first-time visitor.
- Put longer usage details in `docs/`.
- Update both `README.md` and `README_CN.md` when changing user-facing behavior.
- Link security-sensitive behavior to `SECURITY.md`.

## Workflow Prompt Changes

Workflow skills live in `cc_devtools/skills/frontend-devtools-workflows/`.

- Keep `SKILL.md` short and high-level.
- Put mode-specific details in `references/`.
- Add tests when changing prompt loading or action behavior.
- Keep examples concrete, especially for Console, Network, selector, and Local Data Patch workflows.

## Before Submitting

- Keep changes focused — one feature or fix per PR
- No comments unless the WHY is non-obvious
- No new dependencies unless necessary
- Keep `extension/` and `cc_devtools/extension/` behavior in sync
- Keep workflow skill files concise; put mode-specific details in `cc_devtools/skills/frontend-devtools-workflows/references/`
