# Country Selector Loop Demo

This demo is the fastest way to show cc-devtools' Frontend Loop:

```text
Add Singapore to the country selector. Use the local JSON file, then select it and verify it in the page.
```

## Run

From this directory:

```bash
python -m http.server 5173
```

In another terminal, start cc-devtools from the same directory so file actions can read and write this demo:

```bash
cc-devtools
```

Open `http://localhost:5173`, press F12, open the **Claude Code** panel, choose **Frontend Loop**, and paste the prompt above.

## Expected Agent Loop

1. Inspect the live selector and verification output.
2. Run `[ACTION:project:scan][/ACTION]`.
3. Read `public/cc-devtools/countries.json`.
4. Add `{ "code": "SG", "name": "Singapore" }`.
5. Save the JSON file.
6. Refresh or reload data.
7. Select Singapore and click **Verify**.
8. Report the `#verification-output` text as proof.

## Reset

Restore `public/cc-devtools/countries.json` to:

```json
[
  { "code": "US", "name": "United States" },
  { "code": "JP", "name": "Japan" },
  { "code": "DE", "name": "Germany" }
]
```
