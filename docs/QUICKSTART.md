# Quickstart

This guide gets cc-devtools running from zero on a local frontend project.

## 1. Install

```bash
pip install git+https://github.com/xuqinghuan675/cc-devtools.git
```

You also need a CLI AI command available in your terminal. By default cc-devtools runs:

```bash
cc -p
```

To use another command:

```bash
set CC_DEVTOOLS_CMD=claude
```

On macOS/Linux:

```bash
export CC_DEVTOOLS_CMD=claude
```

## 2. Start the Bridge

Start the bridge from your frontend project directory if you want file actions to read or write that project.

```bash
cd path/to/your-frontend-app
cc-devtools
```

You should see:

```text
CC DevTools Bridge running at ws://localhost:9876
```

The bridge stays open while you use the DevTools panel.

## 3. Load the Chrome Extension

Print the extension path:

```bash
cc-devtools-path
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the printed extension directory.
5. Open a web page and press **F12**.
6. Select the **Claude Code** DevTools tab.

## 4. First Useful Prompt

Choose **Inspect** mode and ask:

```text
What does this page do? Summarize the main controls and data shown.
```

Then choose **Debug** mode and ask:

```text
Check console and network. Why is this page failing to load data?
```

For an interactive bug, ask:

```text
The Save button does nothing. Click it, inspect console/network/DOM evidence, and tell me the smallest fix.
```

## 5. Local Data Patch Example

Start the bridge from your app root:

```bash
cd path/to/your-frontend-app
cc-devtools
```

Choose **Local Data Patch** mode and ask:

```text
Add Singapore to the country selector. Use a local JSON file instead of changing the backend.
```

The agent should inspect the page, locate likely data files, read existing source, write a local JSON file inside the bridge root, patch frontend code, and verify the DOM.
It can also scan the frontend project before editing and use click/input actions to verify the final page state.

## 6. Frontend Loop Demo

Use the bundled demo when you want to see the full loop without preparing your own app:

```bash
cc-devtools-demo
cc-devtools-demo --live
```

`--live` starts both the page and bridge, then opens the page in your default browser. If it does not open automatically, open `http://localhost:5173`.

Choose **Frontend Loop**, click **Copy prompt** on the demo page, and ask:

```text
Add Singapore to the country selector. Use the local JSON file, then select it and verify it in the page.
```

The expected result is a local edit to `public/cc-devtools/countries.json` plus browser evidence from `#verification-output`.
Frontend Loop automatically attaches an initial local project scan to the chat payload, so the agent starts with framework, script, entry-file, and data-file hints before it edits.

## Troubleshooting

### The DevTools panel says "not connected"

- Make sure `cc-devtools` is still running.
- Check the bridge port. Default is `9876`.
- If another app uses that port, set `CC_DEVTOOLS_PORT`.

### File actions cannot find my project

Start the bridge from your project root:

```bash
cd path/to/your-frontend-app
cc-devtools
```

Or set:

```bash
set CC_DEVTOOLS_WRITE_ROOT=D:\path\to\your-frontend-app
```

### The CLI AI command is wrong

Set `CC_DEVTOOLS_CMD`:

```bash
set CC_DEVTOOLS_CMD=claude
```

### A page blocks DevTools eval

Some pages, browser-internal URLs, or extension pages may restrict inspection. Test with a normal local app such as `http://localhost:3000`.
