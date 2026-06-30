# Frontend Loop Workflow

Use when the user wants an impressive end-to-end frontend change: understand the live page, understand the local project, patch files on disk, refresh or interact with the page, and report verification evidence.

When this workflow is selected, cc-devtools automatically attaches one local project scan to normal chat payloads when the bridge is available. Treat that context as the initial map, then use explicit actions when you need fresh evidence or exact file contents.

This mode is optimized for demo-worthy tasks such as:

```text
Add Singapore to the country selector. Use a local JSON file, patch the frontend if needed, then click/input verification in the browser.
```

## Loop Contract

1. Start from the live page, not from assumptions.
2. Use the attached project context before local edits so you know framework, scripts, config files, entry files, and data/service candidates.
3. Use `[ACTION:dom]`, `[ACTION:text]`, `[ACTION:console]`, and `[ACTION:network]` to identify the affected UI and data path.
4. Use `[ACTION:file:list]` and `[ACTION:file:read]` before every file edit.
5. Use `[ACTION:save]` only inside the allowed write root.
6. Verify on the page with `[ACTION:click]`, `[ACTION:input]`, `[ACTION:press]`, `[ACTION:text]`, or `[ACTION:dom]`.
7. Finish with evidence: files changed, selector verified, visible page output, and rollback path.

## Preferred Sequence

1. Capture URL and title:
   `[ACTION:url][/ACTION]`
   `[ACTION:title][/ACTION]`
2. Refresh or show the project scan when you need evidence:
   `[ACTION:project:scan][/ACTION]`
3. Inspect the target control:
   `[ACTION:dom]select[name*="country"], #country-select, [role="combobox"][/ACTION]`
4. Find local data and source files:
   `[ACTION:file:list]*countr*[/ACTION]`
   `[ACTION:file:list]*service*[/ACTION]`
   `[ACTION:file:list]*api*[/ACTION]`
5. Read the most likely file before editing:
   `[ACTION:file:read]public/cc-devtools/countries.json[/ACTION]`
6. Patch the smallest local file that can satisfy the request.
7. Refresh or interact with the page. If the page has a country selector, use:
   `[ACTION:click]#country-select[/ACTION]`
   `[ACTION:input]#country-select
Singapore
[/ACTION]`
8. Verify with visible output:
   `[ACTION:text]#verification-output[/ACTION]`

## Country Selector Demo Target

For the bundled demo in `examples/country-selector-loop`, the fastest loop is:

1. Read `public/cc-devtools/countries.json`.
2. Add `{ "code": "SG", "name": "Singapore" }` if it is missing.
3. Save the JSON file.
4. Ask the user to refresh the page if the app does not hot-reload.
5. Select Singapore in `#country-select`.
6. Click `#verify-country`.
7. Confirm `#verification-output` mentions Singapore.

## Output Format

- What changed
- Evidence from project scan
- Files read
- Files written
- Browser verification evidence
- Rollback command or exact file content to restore
