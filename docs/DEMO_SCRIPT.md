# Frontend Loop 60-second demo

Use this script to record the README GIF, a short video, screenshots, or a social post.

The README uses:

- `docs/assets/screenshot-workbench-overview.svg`
- `docs/assets/frontend-loop-demo-animated.svg`
- `docs/assets/screenshot-connection-success.svg`
- `docs/assets/screenshot-network-error.svg`
- `docs/assets/screenshot-json-verified.svg`

Regenerate or validate the lightweight SVG assets with:

```bash
node scripts/generate-demo-assets.mjs
```

## Setup

Terminal:

```bash
cc-devtools-demo
cc-devtools-demo --live
```

Browser:

1. `cc-devtools-demo --live` opens `http://localhost:5173` automatically.
2. If it does not open, open `http://localhost:5173` manually.
3. Press F12.
4. Open the **cc-devtools** DevTools panel.
5. Paste the bridge token if the panel asks for it.
6. Choose **Frontend Loop**.
7. Click **Copy prompt** on the demo page and paste it into Chat.

## 60-second demo flow

Narration:

```text
This is cc-devtools. I am not copying DOM, console logs, or source files into chat. I am chatting directly inside F12, and the Workbench keeps evidence, recorder events, test drafts, patch state, trust policy, and recipes separate.
```

Prompt:

```text
Add Singapore to the country selector. Use the local JSON file, then select it and verify it in the page.
```

Expected loop:

1. The agent inspects the live page.
2. Frontend Loop attaches local project context; the agent can rerun `[ACTION:project:scan][/ACTION]` when it needs fresh evidence.
3. The agent reads `public/cc-devtools/countries.json`.
4. The agent writes Singapore into the local JSON file.
5. The agent reloads data or asks for a page refresh if needed.
6. The agent selects Singapore.
7. The agent clicks Verify.
8. The agent reads `#verification-output` and reports evidence.

Proof to show on screen:

```text
Verified: Singapore (SG) is selectable from local data.
```

## Workbench shots to capture

After the basic demo succeeds, capture these pages:

- **Evidence**: selected action/network/file/verification evidence and Send selected summary.
- **Recorder**: event count, ring-buffer status, and BugBundle preview.
- **Tests**: generated Playwright draft from selected evidence.
- **Patch**: diff preview and `PatchSession` state.
- **Visual**: DOM diagnostic result for `#country-select` or `#verify-country`.
- **Trust**: permission matrix and latest Send Preview.
- **Recipes**: a saved demo recipe and known selectors in Project Memory.

## Reset between takes

```bash
cd examples/country-selector-loop
npm run reset
```

## Posting copy

```text
cc-devtools turns Chrome F12 into a frontend agent Workbench:

live page evidence -> bug recorder -> Playwright draft -> patch transaction -> browser verification -> trust preview

Demo: add Singapore to a country selector by editing local JSON, then verify the result from the real page.
```

## What makes the demo work

- The page reads from `examples/country-selector-loop/public/cc-devtools/countries.json`.
- `Frontend Loop` mode automatically attaches project context, then tells the agent to verify after editing.
- Evidence Board stores action, file, network, DOM, and verification evidence as structured cards.
- Recorder stores summarized event data in a bounded ring buffer.
- File actions are limited to the bridge write root and writes require `CC_DEVTOOLS_ENABLE_WRITE=1`.
- Browser verification uses real selectors such as `#country-select`, `#verify-country`, and `#verification-output`.
