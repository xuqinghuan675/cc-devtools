from io import StringIO
from pathlib import Path
import contextlib
import unittest

from cc_devtools import cli


class DemoCliTests(unittest.TestCase):
    def test_demo_info_points_to_frontend_loop_demo(self):
        info = cli.build_demo_info(port=5173)

        self.assertTrue(Path(info["demo_dir"]).exists())
        self.assertEqual(info["url"], "http://127.0.0.1:5173")
        self.assertEqual(info["bridge_url"], "ws://localhost:9876")
        self.assertIn("python -m http.server 5173", info["page_command"])
        self.assertIn("cc-devtools", info["bridge_command"])
        self.assertIn("Frontend Loop", info["workflow"])
        self.assertIn("Add Singapore to the country selector", info["prompt"])

    def test_live_demo_plan_sets_write_root_and_bridge_port(self):
        info = cli.build_demo_info(port=5173, bridge_port=9876)
        plan = cli.build_live_demo_plan(info)

        self.assertEqual(plan["page_url"], "http://127.0.0.1:5173")
        self.assertEqual(plan["bridge_url"], "ws://localhost:9876")
        self.assertEqual(plan["bridge_env"]["CC_DEVTOOLS_WRITE_ROOT"], info["demo_dir"])
        self.assertEqual(plan["bridge_env"]["CC_DEVTOOLS_PORT"], "9876")
        self.assertIn("cc_devtools.server", " ".join(plan["bridge_args"]))
        self.assertTrue(plan["open_browser"])

    def test_open_demo_url_uses_injected_opener(self):
        opened = []

        ok = cli.open_demo_url("http://127.0.0.1:5173", opener=opened.append)

        self.assertTrue(ok)
        self.assertEqual(opened, ["http://127.0.0.1:5173"])

    def test_demo_cmd_prints_copy_paste_steps(self):
        output = StringIO()

        with contextlib.redirect_stdout(output):
            cli.demo_cmd(["--port", "5173"])

        text = output.getvalue()
        self.assertIn("Frontend Loop demo", text)
        self.assertIn("http://127.0.0.1:5173", text)
        self.assertIn("python -m http.server 5173", text)
        self.assertIn("cc-devtools", text)
        self.assertIn("Add Singapore to the country selector", text)

    def test_demo_cmd_prints_live_mode(self):
        output = StringIO()

        with contextlib.redirect_stdout(output):
            cli.demo_cmd(["--port", "5173", "--bridge-port", "9876"])

        text = output.getvalue()
        self.assertIn("One-command live mode", text)
        self.assertIn("cc-devtools-demo --live", text)
        self.assertIn("ws://localhost:9876", text)
        self.assertIn("opens the demo page automatically", text)

    def test_pyproject_exposes_demo_script(self):
        pyproject = Path("pyproject.toml").read_text(encoding="utf-8")

        self.assertIn('cc-devtools-demo = "cc_devtools.cli:demo_cmd"', pyproject)
        self.assertIn('"cc_devtools" = ["extension/**/*", "skills/**/*", "demo/**/*"]', pyproject)


if __name__ == "__main__":
    unittest.main()
