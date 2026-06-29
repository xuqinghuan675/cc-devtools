import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

const PORT = 9876;
const CC_CMD = 'cc';

const SYSTEM_PROMPT = `你是一个网页助手，通过 Chrome DevTools 扩展与用户沟通。你可以直接操作和检查当前网页。

## 可用操作

在回复中使用以下标签来操作网页：

[ACTION:eval]JavaScript代码[/ACTION] — 在页面上执行 JS 并获取返回值
[ACTION:dom]CSS选择器[/ACTION] — 获取匹配元素的 outerHTML，例如 [ACTION:dom]#main[/ACTION]
[ACTION:dom:all]CSS选择器[/ACTION] — 获取所有匹配元素的简化文本
[ACTION:text]CSS选择器[/ACTION] — 获取元素的可见文本内容
[ACTION:console][/ACTION] — 获取最近的控制台日志
[ACTION:network][/ACTION] — 获取最近的网络请求
[ACTION:title][/ACTION] — 获取页面标题
[ACTION:url][/ACTION] — 获取当前页面 URL
[ACTION:save]文件路径
文件内容（从下一行开始到 [/ACTION] 之前都是文件内容）
[/ACTION] — 将内容写入磁盘文件，路径可以是相对于当前工作目录的相对路径或绝对路径

## 重要规则

1. 先观察再操作 — 先用 dom/text/console 了解页面状态
2. 用户看不到页面截图，你需要用文字描述页面
3. 标签必须完整：方括号括起来，有开始和结束标签
4. 一个回复可以包含多个操作标签
5. 回复语言和用户保持一致`;

function buildPrompt(messages, pageContext) {
  const parts = [SYSTEM_PROMPT];

  if (pageContext) {
    parts.push('\n## 当前页面上下文');
    parts.push(`URL: ${pageContext.url || '未知'}`);
    parts.push(`标题: ${pageContext.title || '未知'}`);
    if (pageContext.bodyText) {
      const truncated = pageContext.bodyText.substring(0, 5000);
      parts.push(`页面文本:\n\`\`\`\n${truncated}\n\`\`\``);
    }
    if (pageContext.console) {
      parts.push(`控制台日志:\n\`\`\`\n${pageContext.console}\n\`\`\``);
    }
    if (pageContext.dom) {
      const truncated = pageContext.dom.substring(0, 3000);
      parts.push(`DOM片段:\n\`\`\`html\n${truncated}\n\`\`\``);
    }
  }

  parts.push('\n## 对话');
  for (const msg of messages) {
    const role = msg.role === 'user' ? '用户' : '助手';
    parts.push(`\n${role}: ${msg.content}`);
  }
  parts.push('\n助手: ');

  return parts.join('\n');
}

function callCC(prompt) {
  return new Promise((resolve, reject) => {
    const cc = spawn(CC_CMD, [
      '-p',
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'json'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: true
    });

    const timer = setTimeout(() => {
      cc.kill();
      reject(new Error('CC 响应超时 (2分钟)'));
    }, 120000);

    let stdout = '';
    let stderr = '';

    cc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    cc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    cc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`CC exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        resolve({ content: stdout });
      }
    });

    cc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    cc.stdin.write(prompt);
    cc.stdin.end();
  });
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let conversation = [];

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: '无效的 JSON' }));
      return;
    }

    if (msg.type === 'chat') {
      const userMessage = { role: 'user', content: msg.content };
      conversation.push(userMessage);

      if (msg.actionResults) {
        let resultsText = '操作结果:\n';
        for (const [actionId, result] of Object.entries(msg.actionResults)) {
          resultsText += `[${actionId}]: ${result}\n`;
        }
        conversation.push({ role: 'user', content: resultsText });
      }

      const prompt = buildPrompt(conversation, msg.pageContext);

      try {
        const response = await callCC(prompt);
        const content = response.content || response.result || response.message || JSON.stringify(response);
        conversation.push({ role: 'assistant', content });
        ws.send(JSON.stringify({ type: 'response', content }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        conversation.pop();
      }
    } else if (msg.type === 'write_file') {
      try {
        const filePath = resolve(msg.path);
        const dir = dirname(filePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(filePath, msg.content, 'utf-8');
        ws.send(JSON.stringify({ type: 'write_result', id: msg.id, path: filePath, success: true }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'write_result', id: msg.id, path: msg.path, success: false, error: err.message }));
      }
    } else if (msg.type === 'reset') {
      conversation = [];
      ws.send(JSON.stringify({ type: 'reset', message: '对话已重置' }));
    }
  });

  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`CC DevTools Bridge 运行在 ws://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请先关闭已运行的 Bridge Server`);
  } else {
    console.error('启动失败:', err.message);
  }
  process.exit(1);
});
