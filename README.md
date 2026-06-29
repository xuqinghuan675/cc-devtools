# cc-devtools

Put your CLI AI (Claude Code, Codex, etc.) inside Chrome F12 DevTools.  
Read webpages as text, modify DOM, execute JS, write files — all through chat.

> Designed for non-multimodal models (DeepSeek, GPT-4o-mini, local LLMs)  
> that can't "see" screenshots. Zero API keys. Fully local.

## How It Works

```
Browser F12 Panel  ←→  WebSocket (localhost:9876)  ←→  cc-devtools bridge  ←→  cc CLI
                              ↕
                       DevTools APIs (eval / DOM / network / console)
                              ↕
                         The Webpage
```

The bridge server spawns your CLI AI in `-p` (print) mode. The Chrome extension extracts page context as text and feeds it to the AI. The AI can actively inspect and manipulate the page using `[ACTION:*]` tags — no MCP, no cloud API, no API keys.

## Quick Start

```bash
pip install cc-devtools
cc-devtools           # start bridge server
cc-devtools-path      # get extension directory path
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the path from `cc-devtools-path`
4. Open any webpage, press **F12** → find the **Claude Code** tab
5. Click **Collect** to send page content to the AI, then chat

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
| `[ACTION:save]path\ncontent[/ACTION]` | Write file to disk |

The AI decides which actions to use — you just chat.

## Requirements

- Python 3.9+
- A CLI AI tool (`cc`, `claude`, etc.) in PATH
- Chrome or any Chromium-based browser

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
A: Yes. Use `[ACTION:save]` to write to disk. Combine with Chrome DevTools Overrides for instant reload.

## License

MIT
