from pathlib import Path
import tempfile
import unittest

from cc_devtools.project_scan import scan_frontend_project


class ProjectScanTests(unittest.TestCase):
    def test_scan_detects_react_vite_and_scripts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "package.json").write_text(
                '{"scripts":{"dev":"vite --host 0.0.0.0","test":"vitest"},"dependencies":{"@vitejs/plugin-react":"latest","react":"latest","vite":"latest"}}',
                encoding="utf-8",
            )
            (root / "vite.config.ts").write_text("export default {}", encoding="utf-8")
            (root / "src").mkdir()
            (root / "src" / "App.tsx").write_text("export function App() { return null }", encoding="utf-8")
            (root / "src" / "services").mkdir()
            (root / "src" / "services" / "countryApi.ts").write_text("export const countries = []", encoding="utf-8")
            (root / "public").mkdir()
            (root / "public" / "countries.json").write_text("[]", encoding="utf-8")

            report = scan_frontend_project(root)

            self.assertIn("Framework: React", report)
            self.assertIn("Bundler: Vite", report)
            self.assertIn("dev: vite --host 0.0.0.0", report)
            self.assertIn("src/App.tsx", report)
            self.assertIn("vite.config.ts", report)
            self.assertIn("src/services/countryApi.ts", report)
            self.assertIn("public/countries.json", report)


if __name__ == "__main__":
    unittest.main()
