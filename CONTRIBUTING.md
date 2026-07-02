# Contributing

## Setup

```bash
git clone https://github.com/xuqinghuan675/cc-devtools.git
cd cc-devtools
pip install -e .
```

## Structure

```text
cc_devtools/    Python package, bundled extension copy, demos, and workflow skills
extension/      Source Chrome DevTools extension
bridge/         Node.js bridge implementation
scripts/        Maintenance scripts, including panel sync and demo asset generation
tests/          Python and Node regression tests
docs/           User-facing docs, demo script, screenshots, and growth checklist
```

`extension/panel` is the source panel directory. `cc_devtools/extension/panel` is the packaged copy. Run the sync script after changing panel files:

```bash
python scripts/sync_panel.py
```

## Testing The Extension

1. Start the bridge: `cc-devtools`
2. Open Chrome at `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `extension/`.
5. Open any page.
6. Press **F12** and open the **cc-devtools** panel.
7. If UI changed, smoke-test Chat, Evidence, Recorder, Visual, Patch, Tests, Trust, and Recipes.

## Automated Checks

Run the smallest relevant subset for narrow changes. Before submitting broad panel, docs, bridge, or release work, run:

```bash
python scripts/sync_panel.py
node --test tests/panel_sync.test.mjs
node --test tests/panel_*.test.mjs
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_*.py"
python -m py_compile scripts/sync_panel.py
node scripts/generate-demo-assets.mjs
git diff --check
```

Use `/` paths instead of `\` on macOS/Linux.

The Python test suite checks README/demo artifacts such as `docs/assets/frontend-loop-demo.svg` and `docs/DEMO_SCRIPT.md`; update those tests when changing the public demo narrative.

## Documentation Changes

- Keep `README.md` and `README_CN.md` aligned for user-facing behavior.
- Update `docs/QUICKSTART.md`, `docs/USE_CASES.md`, and `docs/DEMO_SCRIPT.md` when workflows or screenshots change.
- Update `ACTIONS.txt` and `SECURITY.md` when actions, permissions, redaction, storage, or Trust behavior changes.
- Update `CHANGELOG.md` for notable user-facing changes.
- Regenerate SVG assets with `node scripts/generate-demo-assets.mjs` after changing generated screenshots or social preview content.

## Workflow Prompt Changes

Workflow skills live in `cc_devtools/skills/frontend-devtools-workflows/`.

- Keep `SKILL.md` short and high-level.
- Put mode-specific details in `references/`.
- Add tests when changing prompt loading or action behavior.
- Keep examples concrete, especially for Console, Network, selector, Local Data Patch, Evidence, Recorder, Patch, Tests, Trust, and Recipes workflows.

## Before Submitting

- Keep changes focused: one feature or fix per PR.
- Avoid unrelated formatting churn.
- Avoid new dependencies unless necessary.
- Keep `extension/panel` and `cc_devtools/extension/panel` in sync through `python scripts/sync_panel.py`.
- Do not include secrets, production tokens, private URLs, or sensitive page data in issues, tests, screenshots, or docs.
