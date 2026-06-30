import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from cc_devtools.server import _response_content, call_cc


class CallCCTests(unittest.TestCase):
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
