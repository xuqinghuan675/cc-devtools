# cc-devtools

[![CI](https://github.com/xuqinghuan675/cc-devtools/actions/workflows/ci.yml/badge.svg)](https://github.com/xuqinghuan675/cc-devtools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/python-3.9%2B-blue.svg)](pyproject.toml)
[![Chrome DevTools](https://img.shields.io/badge/Chrome-DevTools-4285F4.svg)](https://developer.chrome.com/docs/devtools)

Put your CLI AI inside Chrome F12 DevTools.

![cc-devtools Frontend Loop demo](docs/assets/frontend-loop-demo-animated.svg)

cc-devtools lets Claude Code, Codex, local LLM CLIs, and other terminal AI tools chat inside F12, inspect live web pages, read console and network evidence, understand the local frontend project, click/type on the page, generate selectors, and patch local frontend files.

> Instead of copying DOM, console errors, network failures, and source snippets into an AI chat, let the AI gather the evidence from DevTools.

[中文 README](README_CN.md) · [Quickstart](docs/QUICKSTART.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Use cases](docs/USE_CASES.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Why Developers Use It

- **Debug faster**: collect Console, Network, DOM, and page text in one workflow.
- **Chat directly in F12**: the panel can attach current page context before each normal chat message.
- **Work in a polished DevTools panel**: compact workflow controls, action reference, readable chat output, and safer local-file actions stay in one F12 surface.
- **Make AI useful for non-visual models**: the page becomes structured text and actions.
- **Understand your frontend first**: Frontend Loop automatically attaches a local project scan covering `package.json`, scripts, framework, bundler, configs, key directories, data/service candidates, and likely entry files.
- **Let the agent operate the page**: click buttons, fill inputs, press keys, and verify the visible result.
- **Generate stable selectors**: ask for Playwright/CSS selectors based on the live DOM.
- **Patch local frontend data**: add options such as a new country by writing local JSON and updating the frontend data path.
- **Stay local-first**: the bridge runs on `localhost`; your chosen CLI AI decides whether inference is local or cloud.

## 30-Second Demo

Run the bundled demo:

```bash
cc-devtools-demo
cc-devtools-demo --live
```

`--live` starts both the demo page and bridge, then opens the page in your default browser. If the browser does not open automatically, open `http://localhost:5173` yourself.

Press F12, choose **Frontend Loop**, click **Copy prompt** on the demo page, then ask:

```text
Add Singapore to the country selector. Use the local JSON file, then select it and verify it in the page.
```

The agent can:

1. Inspect the country selector in the live page.
2. Use the automatically attached project scan to understand files, scripts, and data candidates.
3. Read `public/cc-devtools/countries.json`.
4. Save Singapore into the local JSON file.
5. Reload the page data.
6. Select Singapore and click **Verify**.
7. Report `#verification-output` as browser evidence.

## How It Works

```text
Chrome F12 Panel
   <-> WebSocket ws://localhost:9876
      <-> cc-devtools bridge
         <-> CLI AI command, for example cc -p

The panel exposes DevTools actions:
DOM, text, eval, console, network, page click/input/press, project scan,
file list/read, and safe local writes.
```

cc-devtools does not require its own API key. It starts your configured CLI AI command and sends it structured page context plus workflow instructions.

## Quick Start

```bash
pip install git+https://github.com/xuqinghuan675/cc-devtools.git
cc-devtools
cc-devtools-path
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the path printed by `cc-devtools-path`.
4. Open a web page and press **F12**.
5. Select the **Claude Code** tab.
6. Choose a workflow mode and chat. The panel can collect current page context before normal chat messages.

For screenshots, troubleshooting, and Windows steps, see [docs/QUICKSTART.md](docs/QUICKSTART.md).

## Workflow Modes

| Mode | Use it when you want to |
|---|---|
| Inspect | Understand page structure, content, forms, buttons, and key UI flows |
| Debug | Diagnose console errors, failed requests, broken buttons, or missing data |
| Selector | Generate stable Playwright locators and CSS selectors |
| QA | Run a lightweight release checklist against the live page |
| Local Data Patch | Read/write local project files and make the frontend use local mock data |
| Frontend Loop | Run the full live-page -> auto project context -> file-patch -> browser-verification loop |

The workflow prompts live in [`cc_devtools/skills/frontend-devtools-workflows`](cc_devtools/skills/frontend-devtools-workflows/SKILL.md).

## Actions

| Action | Description |
|---|---|
| `[ACTION:eval]code[/ACTION]` | Execute JavaScript on the inspected page |
| `[ACTION:dom]selector[/ACTION]` | Return the first matched element's `outerHTML` |
| `[ACTION:dom:all]selector[/ACTION]` | Return all matched elements |
| `[ACTION:text]selector[/ACTION]` | Return visible text for an element |
| `[ACTION:click]selector[/ACTION]` | Click a matched element on the inspected page |
| `[ACTION:input]selector\ntext[/ACTION]` | Set an input-like element value and dispatch input/change events |
| `[ACTION:press]key[/ACTION]` | Send keydown/keyup events to the active element |
| `[ACTION:console][/ACTION]` | Return recent console logs |
| `[ACTION:network][/ACTION]` | Return recent network requests |
| `[ACTION:title][/ACTION]` | Return page title |
| `[ACTION:url][/ACTION]` | Return current URL |
| `[ACTION:project:scan][/ACTION]` | Summarize local frontend framework, bundler, scripts, configs, key directories, data/service candidates, dependencies, and entry files |
| `[ACTION:file:list]pattern[/ACTION]` | List local project files under the bridge write root |
| `[ACTION:file:read]path[/ACTION]` | Read a local project file under the bridge write root |
| `[ACTION:save]path\ncontent[/ACTION]` | Write a local file under the bridge write root |

File actions are restricted to `CC_DEVTOOLS_WRITE_ROOT`, or to the directory where you started the bridge.

## Install From Source

```bash
git clone https://github.com/xuqinghuan675/cc-devtools.git
cd cc-devtools
pip install -e .
cc-devtools
```

Node bridge alternative:

```bash
cd bridge
npm install
node server.js
```

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `CC_DEVTOOLS_CMD` | `cc` | CLI AI command to run |
| `CC_DEVTOOLS_PORT` | `9876` | Local WebSocket port |
| `CC_DEVTOOLS_WRITE_ROOT` | current working directory | Directory where file actions may read/write |

## Safety Model

- Use the extension only on pages you trust.
- Page text, DOM snippets, console logs, network summaries, and action results are sent to your CLI AI process.
- `[ACTION:eval]` runs JavaScript in the inspected page.
- Page interaction actions can click, type, or press keys on the inspected page.
- `[ACTION:project:scan]` reads local project metadata under the bridge write root.
- File actions cannot leave the configured write root.
- The DevTools panel escapes ordinary assistant HTML before rendering action blocks.

Read the full policy in [SECURITY.md](SECURITY.md).

## Project Status

cc-devtools is early-stage alpha. The Python bridge is the primary path; the Node bridge is kept as an alternative for users who prefer Node.js.

Good first issues:

- Demo GIF or screenshots for common workflows
- More framework-specific local data patch examples
- Stronger click/input verification examples for React, Vue, Next.js, and Vite apps
- Chrome extension polish and UI accessibility improvements

## Related Ideas

cc-devtools is inspired by the same developer pain that tools like Chrome DevTools, Local Overrides, Playwright locators, and browser-agent integrations address: agents need live browser evidence, not pasted screenshots.

Useful references:

- [Chrome DevTools documentation](https://developer.chrome.com/docs/devtools)
- [Chrome DevTools Local Overrides](https://developer.chrome.com/docs/devtools/overrides)
- [Playwright locators](https://playwright.dev/docs/locators)
- [GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)

## License

MIT
