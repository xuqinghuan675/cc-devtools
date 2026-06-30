from pathlib import Path
import json
import unittest


class CountrySelectorLoopDemoTests(unittest.TestCase):
    def assert_demo_files_define_a_patchable_frontend_loop(self, root):
        index = root / "index.html"
        app = root / "app.js"
        data = root / "public" / "cc-devtools" / "countries.json"
        readme = root / "README.md"

        self.assertTrue(index.exists(), "demo index.html is missing")
        self.assertTrue(app.exists(), "demo app.js is missing")
        self.assertTrue(data.exists(), "demo countries.json is missing")
        self.assertTrue(readme.exists(), "demo README.md is missing")

        app_text = app.read_text(encoding="utf-8")
        self.assertIn("public/cc-devtools/countries.json", app_text)
        self.assertIn("country-select", app_text)
        self.assertIn("verification-output", app_text)
        self.assertIn("copy-demo-prompt", app_text)
        self.assertIn("prompt-copy-status", app_text)

        countries = json.loads(data.read_text(encoding="utf-8"))
        names = {item["name"] for item in countries}
        self.assertIn("United States", names)
        self.assertNotIn("Singapore", names)

        readme_text = readme.read_text(encoding="utf-8")
        self.assertIn("Add Singapore to the country selector", readme_text)
        self.assertIn("Frontend Loop", readme_text)
        self.assertIn("cc-devtools", readme_text)

        html_text = index.read_text(encoding="utf-8")
        self.assertIn("demo-prompt", html_text)
        self.assertIn("copy-demo-prompt", html_text)
        self.assertIn("Step 1", html_text)
        self.assertIn("Step 4", html_text)
        self.assertIn("Press F12", html_text)

    def test_example_demo_files_define_a_patchable_frontend_loop(self):
        self.assert_demo_files_define_a_patchable_frontend_loop(Path("examples/country-selector-loop"))

    def test_packaged_demo_files_define_a_patchable_frontend_loop(self):
        self.assert_demo_files_define_a_patchable_frontend_loop(Path("cc_devtools/demo/country-selector-loop"))


if __name__ == "__main__":
    unittest.main()
