from functools import lru_cache
from pathlib import Path


DEFAULT_WORKFLOW = "inspect"
WORKFLOW_DIR = Path(__file__).parent / "skills" / "frontend-devtools-workflows"
WORKFLOW_FILES = {
    "inspect": "SKILL.md",
    "debug": "references/debugging.md",
    "selector": "references/selectors.md",
    "qa": "references/qa.md",
    "local-data-patch": "references/local-data-patch.md",
}


@lru_cache(maxsize=None)
def get_workflow_prompt(name):
    key = name if name in WORKFLOW_FILES else DEFAULT_WORKFLOW
    path = WORKFLOW_DIR / WORKFLOW_FILES[key]
    return path.read_text(encoding="utf-8")
