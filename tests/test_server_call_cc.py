import subprocess
import unittest
from unittest.mock import patch

from cc_devtools.server import call_cc


class CallCCTests(unittest.TestCase):
    def test_empty_cli_output_raises_actionable_error(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout=None, stderr="")

        with patch("cc_devtools.server.subprocess.run", return_value=completed):
            with self.assertRaisesRegex(RuntimeError, "returned no output"):
                call_cc("hello")

    def test_json_null_cli_output_raises_actionable_error(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout="null", stderr="")

        with patch("cc_devtools.server.subprocess.run", return_value=completed):
            with self.assertRaisesRegex(RuntimeError, "JSON object"):
                call_cc("hello")

    def test_plain_text_cli_output_is_returned_as_content(self):
        completed = subprocess.CompletedProcess(args=["cc"], returncode=0, stdout="hello", stderr="")

        with patch("cc_devtools.server.subprocess.run", return_value=completed):
            self.assertEqual(call_cc("hello"), {"content": "hello"})


if __name__ == "__main__":
    unittest.main()
