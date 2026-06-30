# Frontend Loop 60-second demo

Use this script to record the README GIF, a short video, or a social post.

The README uses `docs/assets/frontend-loop-demo-animated.svg` as the lightweight animated preview. Regenerate or validate it with:

```bash
node scripts/generate-demo-assets.mjs
```

## Setup

Terminal 1:

```bash
cc-devtools-demo
cc-devtools-demo --live
```

Browser:

1. `cc-devtools-demo --live` opens `http://localhost:5173` automatically.
2. If it does not open, open `http://localhost:5173` manually.
3. Press F12.
4. Open the **Claude Code** DevTools panel.
5. Choose **Frontend Loop**.
6. Click **Copy prompt** on the demo page and paste it into the panel.

## 60-second demo flow

Narration:

```text
This is cc-devtools. I am not copying DOM, console logs, or source files into chat. I am chatting directly inside F12.
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

## Reset between takes

```bash
cd examples/country-selector-loop
npm run reset
```

## Posting copy

```text
cc-devtools turns Chrome F12 into a frontend agent loop:

live page evidence -> automatic project context -> local file patch -> browser verification

Demo: add Singapore to a country selector by editing local JSON, then verify the result from the real page.
```

## What makes the demo work

- The page reads from `examples/country-selector-loop/public/cc-devtools/countries.json`.
- `Frontend Loop` mode automatically attaches project context, then tells the agent to verify after editing.
- File actions are limited to the bridge write root.
- Browser verification uses real selectors such as `#country-select`, `#verify-country`, and `#verification-output`.
