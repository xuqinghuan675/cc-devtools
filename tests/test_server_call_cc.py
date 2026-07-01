import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from cc_devtools.server import (
    _file_write_enabled,
    _origin_allowed,
    _permission_mode,
    _response_content,
    _token_authorized,
    call_cc,
)


class CallCCTests(unittest.TestCase):
    def test_default_origin_policy_allows_extension_and_rejects_web_pages(self):
        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            self.assertTrue(_origin_allowed("chrome-extension://abc123"))
            self.assertFalse(_origin_allowed("https://example.test"))
            self.assertFalse(_origin_allowed("http://localhost:5173"))

    def test_token_authorization_requires_matching_configured_token(self):
        with patch.dict("cc_devtools.server.os.environ", {"CC_DEVTOOLS_TOKEN": "secret"}, clear=False):
            self.assertTrue(_token_authorized("secret"))
            self.assertFalse(_token_authorized(""))
            self.assertFalse(_token_authorized("wrong"))

    def test_token_authorization_is_open_when_no_token_is_configured(self):
        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            self.assertTrue(_token_authorized(""))

    def test_file_write_requires_explicit_env_opt_in(self):
        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            self.assertFalse(_file_write_enabled())

        with patch.dict("cc_devtools.server.os.environ", {"CC_DEVTOOLS_ENABLE_WRITE": "1"}, clear=False):
            self.assertTrue(_file_write_enabled())

    def test_cli_uses_auto_permission_mode_by_default(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout='{"content":"ok"}', stderr="")

        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            with patch("cc_devtools.server.subprocess.run", return_value=completed) as run:
                self.assertEqual(call_cc("hello"), {"content": "ok"})

        command = run.call_args.args[0]
        self.assertIn("--permission-mode", command)
        self.assertIn("auto", command)

    def test_cli_uses_requested_plan_permission_mode(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout='{"content":"ok"}', stderr="")

        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            with patch("cc_devtools.server.subprocess.run", return_value=completed) as run:
                self.assertEqual(call_cc("hello", permission_mode="plan"), {"content": "ok"})

        command = run.call_args.args[0]
        self.assertIn("--permission-mode", command)
        self.assertIn("plan", command)

    def test_cli_bypass_permissions_requires_explicit_request_or_env_opt_in(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout='{"content":"ok"}', stderr="")

        with patch.dict("cc_devtools.server.os.environ", {"CC_DEVTOOLS_BYPASS": "1"}, clear=False):
            with patch("cc_devtools.server.subprocess.run", return_value=completed) as run:
                self.assertEqual(call_cc("hello"), {"content": "ok"})

        command = run.call_args.args[0]
        self.assertIn("--permission-mode", command)
        self.assertIn("bypassPermissions", command)

        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            with patch("cc_devtools.server.subprocess.run", return_value=completed) as run:
                self.assertEqual(call_cc("hello", permission_mode="bypassPermissions"), {"content": "ok"})

        command = run.call_args.args[0]
        self.assertIn("--permission-mode", command)
        self.assertIn("bypassPermissions", command)

    def test_invalid_permission_mode_falls_back_to_auto(self):
        with patch.dict("cc_devtools.server.os.environ", {}, clear=False):
            self.assertEqual(_permission_mode("not-real"), "auto")

    def test_empty_cli_output_raises_actionable_error(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout=None, stderr="")

        with TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "bridge.log"
            with patch("cc_devtools.server.CLI_LOG_PATH", log_path):
                with patch("cc_devtools.server.subprocess.run", return_value=completed):
                    with self.assertRaisesRegex(RuntimeError, "Command:"):
                        call_cc("hello")

            self.assertTrue(log_path.exists())
            log_text = log_path.read_text(encoding="utf-8")
            self.assertIn("stdout_length=0", log_text)
            self.assertIn("prompt_length=5", log_text)

    def test_json_null_cli_output_raises_actionable_error(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout="null", stderr="")

        with patch("cc_devtools.server.subprocess.run", return_value=completed):
            with self.assertRaisesRegex(RuntimeError, "JSON object"):
                call_cc("hello")

    def test_plain_text_cli_output_is_returned_as_content(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout="hello", stderr="")

        with patch("cc_devtools.server.subprocess.run", return_value=completed):
            self.assertEqual(call_cc("hello"), {"content": "hello"})

    def test_cli_output_is_decoded_as_utf8_on_windows(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout='{"result":"好的"}', stderr="")

        with patch("cc_devtools.server.subprocess.run", return_value=completed) as run:
            self.assertEqual(call_cc("你好"), {"result": "好的"})

        self.assertEqual(run.call_args.kwargs["encoding"], "utf-8")
        self.assertEqual(run.call_args.kwargs["errors"], "replace")

    def test_response_content_preserves_empty_result(self):
        self.assertEqual(_response_content({"type": "result", "result": ""}), "")


if __name__ == "__main__":
    unittest.main()
