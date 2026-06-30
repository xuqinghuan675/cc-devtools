from pathlib import Path
import unittest


class WindowsInstallerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.installer = Path("install.bat").read_text(encoding="utf-8").lower()
        cls.start_bridge = Path("start-bridge.bat").read_text(encoding="utf-8").lower()

    def test_installer_uses_python_bridge(self):
        self.assertIn("python -m pip install -e", self.installer)
        self.assertIn("cc-devtools", self.installer)
        self.assertNotIn("where node", self.installer)
        self.assertNotIn("npm install", self.installer)
        self.assertNotIn("node server.js", self.installer)

    def test_installer_handles_existing_bridge_port(self):
        self.assertIn("netstat -ano", self.installer)
        self.assertIn("taskkill", self.installer)
        self.assertIn("9876", self.installer)

    def test_installer_opens_extension_setup_targets(self):
        self.assertIn("chrome://extensions", self.installer)
        self.assertIn("explorer", self.installer)
        self.assertIn("\\extension", self.installer)

    def test_installer_starts_bridge_after_setup(self):
        self.assertIn("start \"cc devtools bridge\"", self.installer)
        self.assertIn("start-bridge.bat", self.installer)

    def test_installer_configures_cli_and_write_root(self):
        self.assertIn("where cc", self.installer)
        self.assertIn("where claude", self.installer)
        self.assertIn("cc_devtools_cmd", self.installer)
        self.assertIn("cc_devtools_write_root", self.installer)
        self.assertIn("cc_devtools_log", self.installer)

    def test_start_bridge_is_self_contained(self):
        self.assertIn("-m cc_devtools.server", self.start_bridge)
        self.assertIn("cc_devtools_cmd", self.start_bridge)
        self.assertIn("cc_devtools_write_root", self.start_bridge)
        self.assertIn("cc_devtools_log", self.start_bridge)
        self.assertIn("netstat -ano", self.start_bridge)
        self.assertIn("taskkill", self.start_bridge)
        self.assertIn("bridge stopped with exit code", self.start_bridge)
        self.assertNotIn("node server.js", self.start_bridge)


if __name__ == "__main__":
    unittest.main()
