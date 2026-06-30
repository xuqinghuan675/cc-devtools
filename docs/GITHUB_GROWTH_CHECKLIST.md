# GitHub Growth Checklist

These items are not all controlled by files in the repository, but they help new users understand and share the project.

## Repository Settings

Set a short description:

```text
Put your CLI AI inside Chrome F12 DevTools: inspect live pages, patch local frontend files, and verify changes in the browser.
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

GitHub lets maintainers upload a social preview image from repository settings. Use `docs/assets/frontend-loop-demo-animated.svg` for the README preview and export `docs/assets/social-preview.svg` to PNG before uploading.

Preview text:

```text
cc-devtools
F12 frontend agent loop
Live page • Project scan • Local files • Browser verification
```

## Demo Assets

Record the first public GIF from `docs/DEMO_SCRIPT.md`.

Validate the lightweight animated README preview with:

```bash
node scripts/generate-demo-assets.mjs
```

The GIF should show:

1. `http://localhost:5173` open in Chrome.
2. F12 -> Claude Code panel -> **Frontend Loop**.
3. Prompt: `Add Singapore to the country selector...`.
4. The agent reading and saving `public/cc-devtools/countries.json`.
5. The page showing `Verified: Singapore (SG) is selectable from local data.`

Keep the GIF under 20 seconds for README, then link to a longer video or issue comment if needed.

First-run command to feature in posts:

```bash
cc-devtools-demo --live
```

## Release Checklist

Before publishing a release:

1. Run all tests.
2. Update `CHANGELOG.md`.
3. Build source and wheel distributions.
4. Create a GitHub release with a short demo use case.
5. Attach the Frontend Loop GIF and link `docs/DEMO_SCRIPT.md`.

## Good First Issues

Create issues with these titles:

- Add README GIF for Frontend Loop workflow
- Add screenshot for Local Data Patch workflow
- Add Next.js local-data-patch example
- Add Vue selector workflow example
- Improve DevTools panel keyboard navigation

## README Maintenance

Keep the top half of `README.md` focused on:

1. What the project does
2. Who it helps
3. A 30-second Frontend Loop example
4. Quick install
5. Safety expectations

Move long explanations into `docs/`.
