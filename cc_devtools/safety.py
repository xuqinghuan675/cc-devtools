import os
from pathlib import Path


def get_write_root():
    return Path(os.environ.get("CC_DEVTOOLS_WRITE_ROOT") or os.getcwd()).resolve()


def resolve_write_path(raw_path, root=None):
    text = str(raw_path or "").strip()
    if not text:
        raise ValueError("write path is empty")

    allowed_root = Path(root).resolve() if root is not None else get_write_root()
    path = Path(text)
    candidate = path.resolve() if path.is_absolute() else (allowed_root / path).resolve()

    try:
        candidate.relative_to(allowed_root)
    except ValueError as exc:
        raise ValueError(f"write path is outside allowed root: {allowed_root}") from exc

    return candidate
