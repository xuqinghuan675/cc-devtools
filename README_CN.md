# cc-devtools

把你的 CLI AI（Claude Code、Codex 等）接入 Chrome F12 开发者工具。  
像聊天一样阅览网页、修改 DOM、执行 JS、写入文件。

> 专为非多模态模型设计（DeepSeek、GPT-4o-mini、本地模型），  
> 模型看不到截图，但能通过文本"看懂"网页。零 API key，完全本地。

![](https://placeholder.gif)

## 原理

```
浏览器 F12 面板  ←→  WebSocket (localhost:9876)  ←→  cc-devtools 桥接  ←→  cc CLI
                              ↕
                       DevTools API（eval / DOM / network / console）
                              ↕
                         网页内容
```

桥接服务用 `-p` 模式启动 CLI AI，Chrome 扩展将网页内容转为文本喂给 AI。AI 通过 `[ACTION:*]` 标签主动检查和操作页面 — 不需要 MCP，不需要云 API，不需要 API key。

## 快速开始

```bash
pip install cc-devtools
cc-devtools           # 启动桥接服务
cc-devtools-path      # 获取扩展目录路径
```

然后在 Chrome 中：
1. 打开 `chrome://extensions`
2. 开启右上角**开发者模式**
3. 点击**加载已解压的扩展程序** → 选择 `cc-devtools-path` 输出的路径
4. 打开任意网页，按 **F12** → 找到 **Claude Code** 标签
5. 先点**采集**发送页面内容，然后开始对话

## 功能

| 操作 | 说明 |
|---|---|
| `[ACTION:eval]JS代码[/ACTION]` | 在页面上执行 JS |
| `[ACTION:dom]选择器[/ACTION]` | 获取元素 outerHTML |
| `[ACTION:dom:all]选择器[/ACTION]` | 获取所有匹配元素 |
| `[ACTION:text]选择器[/ACTION]` | 获取可见文本 |
| `[ACTION:console][/ACTION]` | 获取控制台日志（最近200条） |
| `[ACTION:network][/ACTION]` | 获取网络请求（最近20条） |
| `[ACTION:title][/ACTION]` | 获取页面标题 |
| `[ACTION:url][/ACTION]` | 获取当前 URL |
| `[ACTION:save]路径\n内容[/ACTION]` | 写入文件到磁盘 |

AI 自己决定用哪些操作，你只需要像聊天一样提问。

## 环境要求

- Python 3.9+
- 终端中有可用的 CLI AI 命令（`cc`、`claude` 等）
- Chrome 或任意 Chromium 内核浏览器

## Node.js 备选方案

如果你更习惯用 Node.js：

```bash
cd bridge && npm install && node server.js
```

## 常见问题

**Q: 为什么不用 Chrome 内置 AI？**  
A: 内置 AI 需要开实验性 flag，只支持英文。cc-devtools 支持任意 CLI AI、任意语言。

**Q: 支持本地模型吗（Ollama 等）？**  
A: 支持。只要命令行能调用的模型都能用。

**Q: 能改源文件而不只是当前 DOM 吗？**  
A: 能。用 `[ACTION:save]` 写磁盘，配合 Chrome DevTools Overrides 即时生效。

## License

MIT
