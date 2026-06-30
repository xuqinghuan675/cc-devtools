# cc-devtools

把你的 CLI AI（Claude Code、Codex 等）接入 Chrome F12 开发者工具。  
像聊天一样阅览网页、修改 DOM、执行 JS、写入文件。

> 专为非多模态模型设计（DeepSeek、GPT-4o-mini、本地模型），  
> 模型看不到截图，但能通过文本"看懂"网页。cc-devtools 不需要 API key，桥接服务在本机运行。

## 原理

```
浏览器 F12 面板  ←→  WebSocket (localhost:9876)  ←→  cc-devtools 桥接  ←→  cc CLI
                              ↕
                       DevTools API（eval / DOM / network / console）
                              ↕
                         网页内容
```

桥接服务用 `-p` 模式启动 CLI AI，Chrome 扩展将网页内容转为文本喂给 AI。AI 通过 `[ACTION:*]` 标签主动检查和操作页面 — 不需要 MCP，也不需要 cc-devtools API key。

注意：你选择的 CLI AI 可能仍然会使用自己的云服务或本地运行时。cc-devtools 只负责提供本地 DevTools 桥接。

## 为什么做这个

很多前端调试场景里，开发者还在手动复制 console 报错、network 请求、DOM 片段和本地源码给 AI。cc-devtools 把这些变成结构化 DevTools 操作，让 agent 能在真实页面上收集证据，并在允许目录内读取和修改本地前端文件。

## 快速开始

```bash
pip install git+https://github.com/xuqinghuan675/cc-devtools.git
cc-devtools           # 启动桥接服务
cc-devtools-path      # 获取扩展目录路径
```

本地开发：

```bash
git clone https://github.com/xuqinghuan675/cc-devtools.git
cd cc-devtools
pip install -e .
```

然后在 Chrome 中：
1. 打开 `chrome://extensions`
2. 开启右上角**开发者模式**
3. 点击**加载已解压的扩展程序** → 选择 `cc-devtools-path` 输出的路径
4. 打开任意网页，按 **F12** → 找到 **Claude Code** 标签
5. 先点**采集**发送页面内容，然后开始对话

发送前可以在面板里选择工作流模式：

| 模式 | 适用场景 |
|---|---|
| Inspect | 理解页面结构、内容和关键 UI 流程 |
| Debug | 诊断 console 报错、接口失败、按钮无响应、数据不加载 |
| Selector | 生成稳定的 Playwright/CSS selector |
| QA | 对当前页面做轻量发布验收 |
| Local Data Patch | 读取/写入本地项目文件，让前端读取本地 mock 数据 |

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
| `[ACTION:file:list]模式[/ACTION]` | 列出桥接写入目录下的本地项目文件 |
| `[ACTION:file:read]路径[/ACTION]` | 读取桥接写入目录下的本地项目文件 |
| `[ACTION:save]路径\n内容[/ACTION]` | 写入文件到桥接服务允许的目录 |

AI 自己决定用哪些操作，你只需要像聊天一样提问。

## 示例：本地数据 Patch

提问：

```text
给国家选项加 Singapore，用本地 JSON 文件，不改后端。
```

在 **Local Data Patch** 模式下，agent 应该：

1. 检查国家下拉框和当前选项。
2. 查看 Network 中是否有国家数据请求。
3. 用 `[ACTION:file:list]*countr*[/ACTION]` 和 `[ACTION:file:read]...[/ACTION]` 找到前端数据加载逻辑。
4. 写入本地文件，例如 `public/cc-devtools/countries.json`。
5. 修改前端在开发环境读取这个本地文件。
6. 刷新或重新检查 DOM，并给出验证证据。

## 环境要求

- Python 3.9+
- 终端中有可用的 CLI AI 命令（`cc`、`claude` 等）
- Chrome 或任意 Chromium 内核浏览器

## 配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `CC_DEVTOOLS_CMD` | `cc` | 要调用的 CLI AI 命令 |
| `CC_DEVTOOLS_PORT` | `9876` | 本地 WebSocket 端口 |
| `CC_DEVTOOLS_WRITE_ROOT` | 启动桥接服务时的当前目录 | `[ACTION:save]` 允许写入的目录 |

## 安全说明

- 只在你信任的网页上使用这个扩展。页面文本、DOM 片段、控制台日志和操作结果会发送给你的 CLI AI 进程。
- `[ACTION:eval]` 会在当前 inspected page 中执行 JavaScript。
- `[ACTION:file:list]`、`[ACTION:file:read]` 和 `[ACTION:save]` 只能访问 `CC_DEVTOOLS_WRITE_ROOT`，或启动桥接服务时所在的目录。
- DevTools 面板会在渲染普通 AI 回复前转义 HTML，同时保留合法的 action block。

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
A: 能。从你的项目目录启动桥接服务，或设置 `CC_DEVTOOLS_WRITE_ROOT`，然后用 `[ACTION:save]` 写入该目录内的文件。配合 Chrome DevTools Overrides 可以即时生效。

## License

MIT
