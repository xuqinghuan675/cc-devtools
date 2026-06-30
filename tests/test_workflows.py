import unittest

from cc_devtools.server import build_prompt
from cc_devtools.workflows import get_workflow_prompt


class WorkflowPromptTests(unittest.TestCase):
    def test_known_workflow_is_loaded(self):
        prompt = get_workflow_prompt("local-data-patch")

        self.assertIn("Local Data Patch", prompt)
        self.assertIn("country", prompt.lower())

    def test_frontend_loop_workflow_is_loaded(self):
        prompt = get_workflow_prompt("frontend-loop")

        self.assertIn("Frontend Loop", prompt)
        self.assertIn("[ACTION:project:scan][/ACTION]", prompt)
        self.assertIn("[ACTION:click]", prompt)
        self.assertIn("Singapore", prompt)

    def test_unknown_workflow_falls_back_to_inspect(self):
        prompt = get_workflow_prompt("missing-workflow")

        self.assertIn("Inspect", prompt)
        self.assertNotIn("missing-workflow", prompt)

    def test_build_prompt_injects_selected_workflow(self):
        prompt = build_prompt(
            [{"role": "user", "content": "Add Singapore to country list"}],
            {"url": "http://localhost:3000", "title": "App"},
            workflow="local-data-patch",
        )

        self.assertIn("## DevTools Workflow Skill", prompt)
        self.assertIn("Local Data Patch", prompt)
        self.assertIn("read existing files before editing", prompt)

    def test_build_prompt_injects_frontend_loop_workflow(self):
        prompt = build_prompt(
            [{"role": "user", "content": "Add Singapore and verify it in the browser"}],
            {"url": "http://localhost:5173", "title": "Country Selector Loop Demo"},
            workflow="frontend-loop",
        )

        self.assertIn("Frontend Loop", prompt)
        self.assertIn("project:scan", prompt)
        self.assertIn("click/input verification", prompt)

    def test_build_prompt_injects_project_context(self):
        prompt = build_prompt(
            [{"role": "user", "content": "Find the country data file"}],
            {"url": "http://localhost:5173", "title": "Country Selector Loop Demo"},
            workflow="frontend-loop",
            project_context={
                "framework": "React",
                "bundler": "Vite",
                "entryFiles": ["src/App.jsx"],
                "dataHints": ["public/cc-devtools/countries.json"],
            },
        )

        self.assertIn("## 本地项目上下文", prompt)
        self.assertIn('"framework": "React"', prompt)
        self.assertIn("public/cc-devtools/countries.json", prompt)


if __name__ == "__main__":
    unittest.main()
