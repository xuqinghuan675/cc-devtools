# Quickstart

This guide gets cc-devtools running with the least possible setup.

## Windows: Two Steps

Requirements:

- Python 3.9+
- A CLI AI command available as `cc`, `claude`, or `CC_DEVTOOLS_CMD`
- Chrome

### Step 1: Double-click `install.bat`

Download or clone this repository, then double-click:

```text
install.bat
```

The installer does the boring parts for you:

- installs cc-devtools into the current Python environment with `python -m pip install -e`
- detects `cc`, `claude`, or your existing `CC_DEVTOOLS_CMD`
- stops an old bridge process if port `9876` is already occupied
- generates a local `CC_DEVTOOLS_TOKEN`
- creates `start-bridge.bat`
- starts the bridge automatically
- opens `chrome://extensions`
- opens the local `extension` folder

If you restart Windows or close the bridge window later, double-click `start-bridge.bat`.

### Step 2: Load the Chrome Extension

In the Chrome extensions page that opened:

1. Enable **Developer mode**.
2. Click **Load unpacked**.
3. Select the opened `extension` folder.
4. Open any web page.
5. Press **F12**.
6. Select the **cc-devtools** DevTools tab.
7. Paste the token printed by `install.bat` or `start-bridge.bat` into the **Token** field and click **Save**.

You can now chat inside F12. Chat remains the default page, and the Workbench tabs expose Evidence, Recorder, Visual, Patch, Tests, Trust, and Recipes.

## First Useful Prompts

Choose **Inspect** mode and ask:

```text
What does this page do? Summarize the main controls and data shown.
```

Choose **Debug** mode and ask:

```text
Check console and network. Why is this page failing to load data?
```

For an interactive bug, ask:

```text
The Save button does nothing. Click it, inspect console/network/DOM evidence, and tell me the smallest fix.
```

For structured evidence, switch to **Evidence**, select the useful items, then use **Send selected**. The panel shows a redacted send summary before sending.

## Workbench Tabs

- **Chat**: default chat and action loop.
- **Evidence**: select, filter, copy, and send structured evidence.
- **Recorder**: collect a ring-buffered bug flight recording and pack a BugBundle.
- **Visual**: diagnose DOM visibility, clickability, styles, overflow, and coverage for a selector.
- **Patch**: preview, backup, apply, verify, and rollback a conservative file patch transaction.
- **Tests**: generate a copy-only Playwright draft from selected evidence.
- **Trust**: choose Observe Only, Debug Safe, or Patch Sandbox and inspect the permission matrix.
- **Recipes**: maintain manual workflows and Project Memory buckets.

## Local File Actions

File actions are limited to `CC_DEVTOOLS_WRITE_ROOT`.

With the one-click installer, the default write root is the folder where `install.bat` lives. To point file actions at a specific frontend project, set `CC_DEVTOOLS_WRITE_ROOT` before running `install.bat`:

```bat
set CC_DEVTOOLS_WRITE_ROOT=D:\path\to\your-frontend-app
install.bat
```

Then choose **Local Data Patch** or **Frontend Loop** and ask:

```text
Add Singapore to the country selector. Use a local JSON file instead of changing the backend.
```

The agent can inspect the live page, scan the project, read/write files inside the write root, reload page data, click or type in the page, and return browser evidence.

Writes are still gated by `CC_DEVTOOLS_ENABLE_WRITE=1`. The Trust page can block or allow the panel-side action, but it does not bypass the bridge write gate.

## CLI Install

Use the CLI path when you prefer manual control or are not on Windows:

```bash
pip install git+https://github.com/xuqinghuan675/cc-devtools.git
cd path/to/your-frontend-app
cc-devtools
cc-devtools-path
```

Then load the printed extension path in `chrome://extensions`.

## Demo

Use the bundled demo when you want to see the full loop without preparing your own app:

```bash
cc-devtools-demo
cc-devtools-demo --live
```

`--live` starts both the page and bridge, then opens the page in your default browser. If it does not open automatically, open `http://localhost:5173`.

`http://127.0.0.1:5173` or `http://localhost:5173` is only the bundled country-selector demo page. It is useful for testing whether the agent can inspect a page, edit a local JSON file, reload data, click the page, and verify the result. It is not the bridge server. The bridge is the separate console window listening on `ws://localhost:9876`.

Choose **Frontend Loop**, click **Copy prompt** on the demo page, and ask:

```text
Add Singapore to the country selector. Use the local JSON file, then select it and verify it in the page.
```

The expected result is a local edit to `public/cc-devtools/countries.json` plus browser evidence from `#verification-output`.

## Troubleshooting

### The DevTools panel says "not connected"

- Make sure the `CC DevTools Bridge` window is still open.
- If it is closed, double-click `start-bridge.bat`.
- Re-run `install.bat` if another process is occupying port `9876`; it will stop the old listener.
- Confirm the token in the panel matches the token printed by the bridge.

### The panel says the CLI returned no output

- Run `cc --version` or `claude --version` in a terminal.
- Make sure your CLI AI is logged in.
- If you use a custom command, set `CC_DEVTOOLS_CMD` before running `install.bat`.

### File actions cannot find my project

Set `CC_DEVTOOLS_WRITE_ROOT` to your frontend project root, then re-run `install.bat`.

### A page blocks DevTools eval

Some pages, browser-internal URLs, or extension pages may restrict inspection. Test with a normal local app such as `http://localhost:3000`.

### Screenshot capture is unavailable

The current Visual page focuses on DOM diagnostics. Screenshot capability is represented as an explicit status and may remain unsupported until a background capture permission path is added.
