import asyncio
import json
import os
import subprocess
from pathlib import Path

import websockets
from websockets.asyncio.server import serve

PORT = 9876
CC_CMD = "cc"
IS_WINDOWS = os.name == "nt"

SYSTEM_PROMPT = """你是一个网页助手，通过 Chrome DevTools 扩展与用户沟通。你可以直接操作和检查当前网页。

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
[ACTION:copy]要复制的内容[/ACTION] — 将内容复制到系统剪贴板
[ACTION:save]文件路径
文件内容（从下一行开始到 [/ACTION] 之前都是文件内容）
[/ACTION] — 将内容写入磁盘文件，路径可以是相对于当前工作目录的相对路径或绝对路径

## 重要规则

1. 先观察再操作 — 先用 dom/text/console 了解页面状态
2. 用户看不到页面截图，你需要用文字描述页面
3. 标签必须完整：方括号括起来，有开始和结束标签
4. 一个回复可以包含多个操作标签
5. 回复语言和用户保持一致"""


def build_prompt(messages, page_context):
    parts = [SYSTEM_PROMPT]

    if page_context:
        parts.append("\n## 当前页面上下文")
        parts.append(f"URL: {page_context.get('url') or '未知'}")
        parts.append(f"标题: {page_context.get('title') or '未知'}")
        if page_context.get("bodyText"):
            parts.append(f"页面文本:\n```\n{page_context['bodyText'][:5000]}\n```")
        if page_context.get("console"):
            parts.append(f"控制台日志:\n```\n{page_context['console']}\n```")
        if page_context.get("dom"):
            parts.append(f"DOM片段:\n```html\n{page_context['dom'][:3000]}\n```")

    parts.append("\n## 对话")
    for msg in messages:
        role = "用户" if msg["role"] == "user" else "助手"
        parts.append(f"\n{role}: {msg['content']}")
    parts.append("\n助手: ")

    return "\n".join(parts)


def call_cc(prompt):
    try:
        result = subprocess.run(
            [CC_CMD, "-p", "--permission-mode", "bypassPermissions", "--output-format", "json"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=120,
            shell=IS_WINDOWS,
        )
        if result.returncode != 0:
            raise RuntimeError(f"CC exited with code {result.returncode}: {result.stderr}")
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"content": result.stdout}
    except subprocess.TimeoutExpired:
        raise RuntimeError("CC 响应超时 (2分钟)")


async def handle_connection(ws):
    conversation = []
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await ws.send(json.dumps({"type": "error", "message": "invalid JSON"}))
            continue

        try:
            if msg.get("type") == "chat":
                conversation.append({"role": "user", "content": msg.get("content", "")})

                if msg.get("actionResults"):
                    results = "操作结果:\n"
                    for key, val in msg["actionResults"].items():
                        results += f"[{key}]: {val}\n"
                    conversation.append({"role": "user", "content": results})

                prompt = build_prompt(conversation, msg.get("pageContext"))
                try:
                    response = await asyncio.to_thread(call_cc, prompt)
                    content = response.get("content") or response.get("result") or response.get("message") or json.dumps(response)
                    conversation.append({"role": "assistant", "content": content})
                    await ws.send(json.dumps({"type": "response", "content": content}))
                except RuntimeError as e:
                    await ws.send(json.dumps({"type": "error", "message": str(e)}))
                    if conversation and conversation[-1]["role"] == "user":
                        conversation.pop()

            elif msg.get("type") == "write_file":
                try:
                    file_path = Path(msg["path"]).resolve()
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    file_path.write_text(msg["content"], encoding="utf-8")
                    await ws.send(json.dumps({
                        "type": "write_result",
                        "id": msg["id"],
                        "path": str(file_path),
                        "success": True,
                    }))
                except OSError as e:
                    await ws.send(json.dumps({
                        "type": "write_result",
                        "id": msg["id"],
                        "path": msg["path"],
                        "success": False,
                        "error": str(e),
                    }))

            elif msg.get("type") == "reset":
                conversation.clear()
                await ws.send(json.dumps({"type": "reset", "message": "对话已重置"}))
        except Exception as e:
            import traceback
            traceback.print_exc()
            await ws.send(json.dumps({"type": "error", "message": str(e)}))


def main():
    async def run():
        async with serve(handle_connection, "localhost", PORT):
            print(f"CC DevTools Bridge 运行在 ws://localhost:{PORT}")
            print("按 Ctrl+C 停止")
            await asyncio.get_running_loop().create_future()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
