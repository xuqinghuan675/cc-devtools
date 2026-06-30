from pathlib import Path
import unittest
import xml.etree.ElementTree as ET


class GrowthArtifactTests(unittest.TestCase):
    def test_readme_surfaces_frontend_loop_visual(self):
        readme = Path("README.md").read_text(encoding="utf-8")

        self.assertIn("docs/assets/frontend-loop-demo-animated.svg", readme)
        self.assertIn("Frontend Loop", readme)
        self.assertIn("Add Singapore to the country selector", readme)

    def test_demo_script_is_copy_pasteable(self):
        script = Path("docs/DEMO_SCRIPT.md")
        self.assertTrue(script.exists(), "docs/DEMO_SCRIPT.md is missing")

        text = script.read_text(encoding="utf-8")
        self.assertIn("60-second demo", text)
        self.assertIn("examples/country-selector-loop", text)
        self.assertIn("cc-devtools-demo --live", text)
        self.assertIn("opens `http://localhost:5173` automatically", text)
        self.assertIn("Copy prompt", text)
        self.assertIn("cc-devtools", text)
        self.assertIn("Frontend Loop", text)
        self.assertIn("Add Singapore to the country selector", text)
        self.assertIn("#verification-output", text)

    def test_frontend_loop_visual_names_the_closed_loop(self):
        asset = Path("docs/assets/frontend-loop-demo.svg")
        self.assertTrue(asset.exists(), "frontend-loop demo visual is missing")

        text = asset.read_text(encoding="utf-8")
        ET.parse(asset)
        for phrase in (
            "F12 chat",
            "Project scan",
            "Write local JSON",
            "Browser verification",
            "Singapore"
        ):
            self.assertIn(phrase, text)

    def test_animated_demo_asset_and_generator_exist(self):
        asset = Path("docs/assets/frontend-loop-demo-animated.svg")
        generator = Path("scripts/generate-demo-assets.mjs")
        self.assertTrue(asset.exists(), "animated frontend-loop visual is missing")
        self.assertTrue(generator.exists(), "demo asset generator is missing")

        text = asset.read_text(encoding="utf-8")
        for phrase in (
            "Step 1: F12 chat",
            "Step 2: Project scan",
            "Step 3: Write local JSON",
            "Step 4: Browser verification",
            "Verified: Singapore"
        ):
            self.assertIn(phrase, text)
        self.assertIn("<animate", text)

        generator_text = generator.read_text(encoding="utf-8")
        self.assertIn("frontend-loop-demo-animated.svg", generator_text)
        self.assertIn("writeFileSync", generator_text)


if __name__ == "__main__":
    unittest.main()
