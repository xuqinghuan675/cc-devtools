import unittest

from cc_devtools.server import build_prompt
from cc_devtools.workflows import get_workflow_prompt


class WorkflowPromptTests(unittest.TestCase):
    def test_known_workflow_is_loaded(self):
        prompt = get_workflow_prompt("local-data-patch")

        self.assertIn("Local Data Patch", prompt)
        self.assertIn("country", prompt.lower())

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


if __name__ == "__main__":
    unittest.main()
