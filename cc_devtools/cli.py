import argparse
import os
import subprocess
import sys
import webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


DEMO_PROMPT = (
    "Add Singapore to the country selector. Use the local JSON file, "
    "then select it and verify it in the page."
)


def _demo_dir():
    package_demo = Path(__file__).parent / "demo" / "country-selector-loop"
    if package_demo.exists():
        return package_demo

    repo_demo = Path(__file__).resolve().parent.parent / "examples" / "country-selector-loop"
    return repo_demo


def build_demo_info(port=5173, bridge_port=9876):
    demo_dir = _demo_dir().resolve()
    return {
        "demo_dir": str(demo_dir),
        "url": f"http://127.0.0.1:{port}",
        "bridge_url": f"ws://localhost:{bridge_port}",
        "page_command": f"python -m http.server {port}",
        "live_command": f"cc-devtools-demo --live --port {port} --bridge-port {bridge_port}",
        "bridge_command": "cc-devtools",
        "workflow": "Frontend Loop",
        "prompt": DEMO_PROMPT,
    }

def path_cmd():
    ext_dir = os.path.join(os.path.dirname(__file__), "extension")
    print(ext_dir)


def _print_demo_steps(info):
    print("cc-devtools Frontend Loop demo")
    print()
    print(f"Demo directory: {info['demo_dir']}")
    print(f"Page URL: {info['url']}")
    print(f"Bridge URL: {info['bridge_url']}")
    print()
    print("One-command live mode:")
    print(f"  {info['live_command']}")
    print("  (opens the demo page automatically)")
    print()
    print("Terminal 1:")
    print(f"  cd {info['demo_dir']}")
    print(f"  {info['page_command']}")
    print()
    print("Terminal 2:")
    print(f"  cd {info['demo_dir']}")
    print(f"  {info['bridge_command']}")
    print()
    print("Chrome:")
    print(f"  1. Open {info['url']}")
    print("  2. Press F12")
    print("  3. Open the Claude Code DevTools panel")
    print(f"  4. Choose {info['workflow']}")
    print("  5. Paste this prompt:")
    print()
    print(info["prompt"])


def build_live_demo_plan(info):
    return {
        "page_url": info["url"],
        "bridge_url": info["bridge_url"],
        "demo_dir": info["demo_dir"],
        "bridge_args": [sys.executable, "-m", "cc_devtools.server"],
        "open_browser": True,
        "bridge_env": {
            "CC_DEVTOOLS_WRITE_ROOT": info["demo_dir"],
            "CC_DEVTOOLS_PORT": info["bridge_url"].rsplit(":", 1)[-1],
        },
    }


def open_demo_url(url, opener=webbrowser.open):
    try:
        return opener(url) is not False
    except Exception:
        return False


def _start_bridge(plan):
    env = os.environ.copy()
    env.update(plan["bridge_env"])
    return subprocess.Popen(
        plan["bridge_args"],
        cwd=plan["demo_dir"],
        env=env,
    )


def _serve_demo(demo_dir, port):
    class DemoHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(demo_dir), **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", port), DemoHandler)
    print(f"Serving cc-devtools demo at http://127.0.0.1:{port}")
    print(f"Root: {demo_dir}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


def demo_cmd(argv=None):
    parser = argparse.ArgumentParser(description="Show or serve the cc-devtools Frontend Loop demo.")
    parser.add_argument("--port", type=int, default=5173, help="Local HTTP port for the demo page.")
    parser.add_argument("--bridge-port", type=int, default=9876, help="Local WebSocket port for the bridge.")
    parser.add_argument("--serve", action="store_true", help="Start a static HTTP server for the demo page.")
    parser.add_argument("--live", action="store_true", help="Start both the static demo page and the cc-devtools bridge.")
    parser.add_argument("--no-open", action="store_true", help="Do not open the demo page in the default browser.")
    args = parser.parse_args(argv)

    info = build_demo_info(port=args.port, bridge_port=args.bridge_port)
    _print_demo_steps(info)

    if args.live:
        plan = build_live_demo_plan(info)
        print()
        print(f"Starting bridge at {plan['bridge_url']} with write root {plan['demo_dir']}")
        bridge = _start_bridge(plan)
        if plan["open_browser"] and not args.no_open:
            if open_demo_url(plan["page_url"]):
                print(f"Opened {plan['page_url']}")
            else:
                print(f"Open {plan['page_url']} in Chrome, then press F12.")
        try:
            _serve_demo(Path(info["demo_dir"]), args.port)
        finally:
            bridge.terminate()
            try:
                bridge.wait(timeout=5)
            except subprocess.TimeoutExpired:
                bridge.kill()
    elif args.serve:
        print()
        _serve_demo(Path(info["demo_dir"]), args.port)
