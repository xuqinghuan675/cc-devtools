# Contributing

## Setup

```bash
git clone <repo-url>
cd cc-devtools
pip install -e .
```

## Structure

```
cc_devtools/    Python package (bridge server + CLI)
extension/      Chrome DevTools extension
bridge/         Node.js alternative bridge
```

## Testing the Extension

1. Start the bridge: `cc-devtools`
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `extension/`
3. Open any page, F12 → Claude Code tab

## Automated Checks

```bash
python -m unittest discover -s tests -p "test_*.py"
node --test tests\bridge_safety.test.mjs tests\panel_parse_actions.test.mjs
node --check bridge\server.js
node --check bridge\workflows.js
node --check bridge\file-actions.js
node --check cc_devtools\extension\panel\panel.js
```

## Before Submitting

- Keep changes focused — one feature or fix per PR
- No comments unless the WHY is non-obvious
- No new dependencies unless necessary
- Keep `extension/` and `cc_devtools/extension/` behavior in sync
- Keep workflow skill files concise; put mode-specific details in `cc_devtools/skills/frontend-devtools-workflows/references/`
