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

## Before Submitting

- Keep changes focused — one feature or fix per PR
- No comments unless the WHY is non-obvious
- No new dependencies unless necessary
