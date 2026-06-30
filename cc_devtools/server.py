import asyncio
from datetime import datetime
import json
import os
from pathlib import Path
import secrets
import subprocess
from urllib.parse import parse_qs, urlsplit

import websockets
from websockets.asyncio.server import serve

try:
    from .file_actions import list_files, read_file
    from .project_scan import scan_frontend_project
    from .safety import get_write_root, resolve_write_path
    from .workflows import get_workflow_prompt
except ImportError:
    from file_actions import list_files, read_file
    from project_scan import scan_frontend_project
    from safety import get_write_root, resolve_write_path
    from workflows import get_workflow_prompt

PORT = int(os.environ.get("CC_DEVTOOLS_PORT", "9876"))
CC_CMD = os.environ.get("CC_DEVTOOLS_CMD", "cc")
IS_WINDOWS = os.name == "nt"
WRITE_ROOT = get_write_root()
CLI_LOG_PATH = Path(os.environ.get("CC_DEVTOOLS_LOG") or (Path.cwd() / "cc-devtools-bridge.log"))
DEFAULT_ALLOWED_ORIGIN_PREFIXES = ("chrome-extension://",)
TRUTHY_VALUES = {"1", "true", "yes", "on"}

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
[ACTION:click]CSS选择器[/ACTION] — 点击页面元素
[ACTION:input]CSS选择器
文本[/ACTION] — 向输入框填入文本并触发 input/change 事件
[ACTION:press]按键名[/ACTION] — 向当前焦点元素派发键盘事件
[ACTION:file:list]glob模式[/ACTION] — 列出允许目录内的本地项目文件
[ACTION:file:read]文件路径[/ACTION] — 读取允许目录内的本地项目文件
[ACTION:project:scan][/ACTION] — 扫描本地前端项目框架、脚本、配置、关键目录、入口文件和数据/service候选文件
[ACTION:save]文件路径
文件内容（从下一行开始到 [/ACTION] 之前都是文件内容）
[/ACTION] — 将内容写入 Bridge Server 允许的工作目录内

## 重要规则

1. 先观察再操作 — 先用 dom/text/console 了解页面状态
2. 用户看不到页面截图，你需要用文字描述页面
3. 标签必须完整：方括号括起来，有开始和结束标签
4. 一个回复可以包含多个操作标签
5. 回复语言和用户保持一致
6. file 和 save 只能访问允许目录，不要尝试读取或覆盖系统路径、密钥、token 或用户未明确要求的文件"""


def _format_project_context(project_context):
    if isinstance(project_context, str):
        return project_context[:6000]
    return json.dumps(project_context, ensure_ascii=False, indent=2)[:6000]


def _truthy_env(name):
    return os.environ.get(name, "").strip().lower() in TRUTHY_VALUES


def _split_env_list(name):
    return tuple(part.strip() for part in os.environ.get(name, "").split(",") if part.strip())


def _matches_allowed_origin(origin, allowed):
    for pattern in allowed:
        if pattern.endswith("*") and origin.startswith(pattern[:-1]):
            return True
        if origin == pattern:
            return True
    return False


def _origin_allowed(origin):
    origin = (origin or "").strip()
    if not origin:
        return True

    configured = _split_env_list("CC_DEVTOOLS_ALLOWED_ORIGINS")
    if configured:
        return _matches_allowed_origin(origin, configured)

    return origin.startswith(DEFAULT_ALLOWED_ORIGIN_PREFIXES)


def _token_authorized(token):
    expected = os.environ.get("CC_DEVTOOLS_TOKEN", "").strip()
    if not expected:
        return True
    return secrets.compare_digest(str(token or ""), expected)


def _file_write_enabled():
    return _truthy_env("CC_DEVTOOLS_ENABLE_WRITE")


def _bypass_permissions_enabled():
    return _truthy_env("CC_DEVTOOLS_BYPASS")


def _request_headers(ws):
    request = getattr(ws, "request", None)
    headers = getattr(request, "headers", None)
    if headers is None:
        headers = getattr(ws, "request_headers", None)
    return headers


def _header_value(headers, name):
    if not headers:
        return ""
    try:
        return headers.get(name, "")
    except AttributeError:
        return ""


def _request_path(ws):
    request = getattr(ws, "request", None)
    return getattr(request, "path", None) or getattr(ws, "path", "") or ""


def _request_origin(ws):
    return _header_value(_request_headers(ws), "Origin")


def _request_token(ws):
    query = parse_qs(urlsplit(_request_path(ws)).query)
    token = (query.get("token") or [""])[0]
    if token:
        return token

    headers = _request_headers(ws)
    header_token = _header_value(headers, "X-CC-DevTools-Token")
    if header_token:
        return header_token

    auth = _header_value(headers, "Authorization")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()

    return ""


def _connection_authorization_error(ws):
    origin = _request_origin(ws)
    if not _origin_allowed(origin):
        return f"WebSocket origin not allowed: {origin}"
    if not _token_authorized(_request_token(ws)):
        return "invalid or missing CC_DEVTOOLS_TOKEN"
    return ""


def build_prompt(messages, page_context, workflow=None, project_context=None):
    parts = [SYSTEM_PROMPT]
    parts.append(f"\n允许写入目录: {WRITE_ROOT}")
    parts.append("\n## DevTools Workflow Skill")
    parts.append(get_workflow_prompt(workflow or "inspect"))

    if project_context:
        parts.append("\n## 本地项目上下文")
        parts.append(f"```json\n{_format_project_context(project_context)}\n```")

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


def _tail(text, limit=1200):
    if not text:
        return ""
    text = str(text).strip()
    return text[-limit:]


def _command_display(command):
    try:
        return subprocess.list2cmdline(command)
    except Exception:
        return " ".join(str(part) for part in command)


def _write_cli_log(command, result=None, error=None, prompt_length=0):
    try:
        CLI_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "",
            f"[{datetime.now().isoformat(timespec='seconds')}] cc-devtools CLI call",
            f"cwd={Path.cwd()}",
            f"command={_command_display(command)}",
            f"prompt_length={prompt_length}",
        ]
        if result is not None:
            stdout = result.stdout or ""
            stderr = result.stderr or ""
            lines.extend([
                f"returncode={result.returncode}",
                f"stdout_length={len(stdout)}",
                f"stderr_length={len(stderr)}",
            ])
            if stdout:
                lines.append("stdout_tail=" + _tail(stdout))
            if stderr:
                lines.append("stderr_tail=" + _tail(stderr))
        if error is not None:
            lines.append(f"error={type(error).__name__}: {error}")
        CLI_LOG_PATH.write_text(
            (CLI_LOG_PATH.read_text(encoding="utf-8") if CLI_LOG_PATH.exists() else "")
            + "\n".join(lines)
            + "\n",
            encoding="utf-8",
        )
    except OSError:
        pass


def _response_content(response):
    for key in ("content", "result", "message"):
        if key in response and response[key] is not None:
            return str(response[key])
    return json.dumps(response, ensure_ascii=False)


def call_cc(prompt):
    command = [CC_CMD, "-p"]
    if _bypass_permissions_enabled():
        command.extend(["--permission-mode", "bypassPermissions"])
    command.extend(["--output-format", "json"])
    try:
        result = subprocess.run(
            command,
            input=prompt,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
            shell=IS_WINDOWS,
        )
        _write_cli_log(command, result=result, prompt_length=len(prompt))
        if result.returncode != 0:
            stderr = _tail(result.stderr)
            raise RuntimeError(
                f"CC exited with code {result.returncode}. "
                f"Command: {_command_display(command)}. Stderr: {stderr}. Log: {CLI_LOG_PATH}"
            )

        stdout = result.stdout
        if not stdout or not stdout.strip():
            stderr = (result.stderr or "").strip()
            detail = f" Stderr: {_tail(stderr)}." if stderr else ""
            raise RuntimeError(
                "CC command returned no output. "
                f"Command: {_command_display(command)}. "
                f"Exit code: {result.returncode}.{detail} "
                f"Check CC_DEVTOOLS_CMD and CLI authentication. Log: {CLI_LOG_PATH}"
            )

        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError:
            return {"content": stdout}

        if not isinstance(parsed, dict):
            raise RuntimeError(
                f"CC command returned JSON {type(parsed).__name__}, expected JSON object. Log: {CLI_LOG_PATH}"
            )
        return parsed
    except FileNotFoundError as e:
        _write_cli_log(command, error=e, prompt_length=len(prompt))
        raise RuntimeError(f"CC command not found: {CC_CMD}. Set CC_DEVTOOLS_CMD. Log: {CLI_LOG_PATH}") from e
    except subprocess.TimeoutExpired:
        _write_cli_log(command, error="timeout", prompt_length=len(prompt))
        raise RuntimeError(f"CC 响应超时 (2分钟). Command: {_command_display(command)}. Log: {CLI_LOG_PATH}")


async def handle_connection(ws):
    auth_error = _connection_authorization_error(ws)
    if auth_error:
        await ws.close(code=1008, reason=auth_error)
        return

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

                prompt = build_prompt(
                    conversation,
                    msg.get("pageContext"),
                    msg.get("workflow"),
                    msg.get("projectContext"),
                )
                try:
                    response = await asyncio.to_thread(call_cc, prompt)
                    content = _response_content(response)
                    conversation.append({"role": "assistant", "content": content})
                    await ws.send(json.dumps({"type": "response", "content": content}))
                except RuntimeError as e:
                    await ws.send(json.dumps({"type": "error", "message": str(e)}))
                    if conversation and conversation[-1]["role"] == "user":
                        conversation.pop()

            elif msg.get("type") == "write_file":
                try:
                    if not _file_write_enabled():
                        raise PermissionError("file writing is disabled; set CC_DEVTOOLS_ENABLE_WRITE=1 to enable it")
                    file_path = resolve_write_path(msg["path"], WRITE_ROOT)
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    file_path.write_text(msg["content"], encoding="utf-8")
                    await ws.send(json.dumps({
                        "type": "write_result",
                        "id": msg["id"],
                        "path": str(file_path),
                        "success": True,
                    }))
                except (OSError, PermissionError, ValueError) as e:
                    await ws.send(json.dumps({
                        "type": "write_result",
                        "id": msg["id"],
                        "path": msg["path"],
                        "success": False,
                        "error": str(e),
                    }))

            elif msg.get("type") == "file_list":
                try:
                    files = list_files(WRITE_ROOT, msg.get("pattern") or "**/*")
                    await ws.send(json.dumps({
                        "type": "file_result",
                        "id": msg["id"],
                        "success": True,
                        "result": "\n".join(files) if files else "(no matching files)",
                    }))
                except (OSError, ValueError) as e:
                    await ws.send(json.dumps({
                        "type": "file_result",
                        "id": msg["id"],
                        "success": False,
                        "error": str(e),
                    }))

            elif msg.get("type") == "file_read":
                try:
                    content = read_file(msg["path"], WRITE_ROOT)
                    await ws.send(json.dumps({
                        "type": "file_result",
                        "id": msg["id"],
                        "success": True,
                        "result": content,
                    }))
                except (OSError, ValueError, KeyError) as e:
                    await ws.send(json.dumps({
                        "type": "file_result",
                        "id": msg.get("id"),
                        "success": False,
                        "error": str(e),
                    }))

            elif msg.get("type") == "project_scan":
                try:
                    await ws.send(json.dumps({
                        "type": "file_result",
                        "id": msg["id"],
                        "success": True,
                        "result": scan_frontend_project(WRITE_ROOT),
                    }))
                except (OSError, ValueError) as e:
                    await ws.send(json.dumps({
                        "type": "file_result",
                        "id": msg.get("id"),
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
            print(f"文件写入目录: {WRITE_ROOT}")
            print(f"CLI 命令: {CC_CMD}")
            print(f"日志文件: {CLI_LOG_PATH}")
            if os.environ.get("CC_DEVTOOLS_TOKEN", "").strip():
                print("WebSocket token 鉴权: 已启用")
            else:
                print("WebSocket token 鉴权: 未启用，设置 CC_DEVTOOLS_TOKEN 可启用")
            print(f"文件写入: {'已启用' if _file_write_enabled() else '默认禁用，设置 CC_DEVTOOLS_ENABLE_WRITE=1 可启用'}")
            print(f"CLI bypassPermissions: {'已启用' if _bypass_permissions_enabled() else '默认禁用'}")
            print("按 Ctrl+C 停止")
            await asyncio.get_running_loop().create_future()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
