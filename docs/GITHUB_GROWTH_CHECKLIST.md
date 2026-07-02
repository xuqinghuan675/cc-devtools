# GitHub Growth Checklist

These items are not all controlled by files in the repository, but they help new users understand and share the project.

## Repository Settings

Set a short description:

```text
Put your CLI AI inside Chrome F12 DevTools: collect evidence, record bugs, draft tests, patch local files, and verify changes.
```

Suggested topics:

```text
chrome-devtools
browser-extension
claude-code
codex
ai-tools
frontend
debugging
playwright
websocket
local-first
developer-tools
chrome-extension
```

Add a website URL if you later publish docs or a demo page.

## Social Preview

GitHub lets maintainers upload a social preview image from repository settings. Use the Workbench overview as the current README preview:

```text
docs/assets/screenshot-workbench-overview.svg
```

If GitHub requires PNG, export either `docs/assets/screenshot-workbench-overview.svg` or `docs/assets/social-preview.svg` to PNG before uploading.

Preview text:

```text
cc-devtools
F12 frontend agent Workbench
Evidence -> Recorder -> Tests -> Patch -> Trust
```

## Demo Assets

Record the first public GIF from `docs/DEMO_SCRIPT.md`.

Validate the lightweight SVG README previews with:

```bash
node scripts/generate-demo-assets.mjs
```

The GIF should show:

1. `http://localhost:5173` open in Chrome.
2. F12 -> cc-devtools panel -> **Frontend Loop**.
3. Prompt: `Add Singapore to the country selector...`.
4. The agent reading and saving `public/cc-devtools/countries.json`.
5. The page showing `Verified: Singapore (SG) is selectable from local data.`
6. Evidence or Recorder showing structured proof after the chat loop.

Keep the GIF under 20 seconds for README, then link to a longer video or issue comment if needed.

First-run command to feature in posts:

```bash
cc-devtools-demo --live
```

## Release Checklist

Before publishing a release:

1. Run all tests.
2. Update `CHANGELOG.md`.
3. Regenerate docs assets with `node scripts/generate-demo-assets.mjs`.
4. Build source and wheel distributions.
5. Create a GitHub release with a short demo use case.
6. Attach the Frontend Loop GIF and link `docs/DEMO_SCRIPT.md`.

## Good First Issues

Create issues with these titles:

- Add real README screenshots for each Workbench page
- Add screenshot or video for Evidence Board workflow
- Add screenshot or video for Recorder -> BugBundle workflow
- Add Next.js local-data-patch example
- Add Vue selector workflow example
- Improve DevTools panel keyboard navigation

## README Maintenance

Keep the top half of `README.md` focused on:

1. What the project does
2. Current Workbench status
3. Who it helps
4. A 30-second Frontend Loop example
5. Quick install
6. Safety expectations

Move long explanations into `docs/`.
