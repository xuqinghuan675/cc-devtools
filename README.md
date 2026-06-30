# cc-devtools

Put your CLI AI (Claude Code, Codex, etc.) inside Chrome F12 DevTools.  
Read webpages as text, modify DOM, execute JS, write files — all through chat.

> Designed for non-multimodal models (DeepSeek, GPT-4o-mini, local LLMs)  
> that can't "see" screenshots. No API keys for cc-devtools; the bridge runs locally.

## How It Works

```
Browser F12 Panel  ←→  WebSocket (localhost:9876)  ←→  cc-devtools bridge  ←→  cc CLI
                              ↕
                       DevTools APIs (eval / DOM / network / console)
                              ↕
                         The Webpage
```

The bridge server spawns your CLI AI in `-p` (print) mode. The Chrome extension extracts page context as text and feeds it to the AI. The AI can actively inspect and manipulate the page using `[ACTION:*]` tags — no MCP and no cc-devtools API key.

Your chosen CLI AI may still use its own cloud service or local runtime. cc-devtools only provides the local DevTools bridge.

## Why This Exists

Most frontend debugging with AI still means copying console errors, network failures, DOM snippets, and local source files into a chat. cc-devtools turns those into structured DevTools actions so the agent can inspect the live page, gather evidence, and patch local project files without leaving the browser workflow.

## Quick Start

```bash
pip install git+https://github.com/xuqinghuan675/cc-devtools.git
cc-devtools           # start bridge server
cc-devtools-path      # get extension directory path
```

For local development:

```bash
git clone https://github.com/xuqinghuan675/cc-devtools.git
cd cc-devtools
pip install -e .
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the path from `cc-devtools-path`
4. Open any webpage, press **F12** → find the **Claude Code** tab
5. Click **Collect** to send page content to the AI, then chat

Choose a workflow mode in the DevTools panel before sending:

| Mode | Use it for |
|---|---|
| Inspect | Understand page structure, content, and key UI flows |
| Debug | Diagnose console errors, failed requests, broken buttons, and missing data |
| Selector | Produce stable Playwright/CSS selectors |
| QA | Run a lightweight release checklist against the live page |
| Local Data Patch | Read/write local project files and make the frontend use local mock data |

## Features

| Action | Description |
|---|---|
| `[ACTION:eval]code[/ACTION]` | Execute JS on the page |
| `[ACTION:dom]selector[/ACTION]` | Get element outerHTML |
| `[ACTION:dom:all]selector[/ACTION]` | Get all matching elements |
| `[ACTION:text]selector[/ACTION]` | Get visible text content |
| `[ACTION:console][/ACTION]` | Get console logs (last 200) |
| `[ACTION:network][/ACTION]` | Get recent network requests |
| `[ACTION:title][/ACTION]` | Get page title |
| `[ACTION:url][/ACTION]` | Get current URL |
| `[ACTION:file:list]pattern[/ACTION]` | List local project files under the bridge write root |
| `[ACTION:file:read]path[/ACTION]` | Read a local project file under the bridge write root |
| `[ACTION:save]path\ncontent[/ACTION]` | Write file under the bridge write root |

The AI decides which actions to use — you just chat.

## Example: Local Data Patch

Ask:

```text
Add Singapore to the country selector. Use a local JSON file instead of changing the backend.
```

In **Local Data Patch** mode the agent should:

1. Inspect the country selector and current options.
2. Check Network for country data requests.
3. Use `[ACTION:file:list]*countr*[/ACTION]` and `[ACTION:file:read]...[/ACTION]` to find the frontend data loader.
4. Write a local file such as `public/cc-devtools/countries.json`.
5. Patch the frontend to read that local file in development.
6. Refresh or re-check the DOM and report verification evidence.

## Requirements

- Python 3.9+
- A CLI AI tool (`cc`, `claude`, etc.) in PATH
- Chrome or any Chromium-based browser

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `CC_DEVTOOLS_CMD` | `cc` | CLI AI command to run |
| `CC_DEVTOOLS_PORT` | `9876` | Local WebSocket port |
| `CC_DEVTOOLS_WRITE_ROOT` | current working directory | Directory where `[ACTION:save]` may write files |

## Security Notes

- Use this extension only on pages you trust. Page text, DOM snippets, console logs, and action results are sent to your CLI AI process.
- `[ACTION:eval]` runs JavaScript in the inspected page.
- `[ACTION:file:list]`, `[ACTION:file:read]`, and `[ACTION:save]` are restricted to `CC_DEVTOOLS_WRITE_ROOT` or the directory where you started the bridge server.
- The DevTools panel escapes ordinary assistant HTML before rendering it, while preserving recognized action blocks.

## Node.js Alternative

If you prefer Node.js over Python:

```bash
cd bridge && npm install && node server.js
```

## FAQ

**Q: Why not use Chrome's built-in AI?**  
A: Built-in AI requires flags and only works in English. cc-devtools works with any CLI AI, any language.

**Q: Does it work with local models (Ollama, etc.)?**  
A: Yes. Any CLI tool that accepts prompts via stdin and outputs text works.

**Q: Can it modify source files, not just the live DOM?**  
A: Yes. Start the bridge from your project directory, or set `CC_DEVTOOLS_WRITE_ROOT`, then use `[ACTION:save]` to write inside that directory. Combine with Chrome DevTools Overrides for instant reload.

## License

MIT
