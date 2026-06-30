import os
from pathlib import Path


SENSITIVE_FILE_NAMES = {
    ".env",
    ".npmrc",
    ".pypirc",
    ".netrc",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
}
SENSITIVE_DIR_FILE_PAIRS = {
    (".git", "config"),
    (".ssh", "config"),
}


def get_write_root():
    return Path(os.environ.get("CC_DEVTOOLS_WRITE_ROOT") or os.getcwd()).resolve()


def is_sensitive_path(path):
    parts = tuple(part.lower() for part in Path(path).parts)
    if not parts:
        return False

    name = parts[-1]
    if name in SENSITIVE_FILE_NAMES or name.startswith(".env."):
        return True

    return any((parts[i], parts[i + 1]) in SENSITIVE_DIR_FILE_PAIRS for i in range(len(parts) - 1))


def resolve_write_path(raw_path, root=None):
    text = str(raw_path or "").strip()
    if not text:
        raise ValueError("write path is empty")

    allowed_root = Path(root).resolve() if root is not None else get_write_root()
    path = Path(text)
    candidate = path.resolve() if path.is_absolute() else (allowed_root / path).resolve()

    try:
        relative = candidate.relative_to(allowed_root)
    except ValueError as exc:
        raise ValueError(f"write path is outside allowed root: {allowed_root}") from exc

    if is_sensitive_path(relative):
        raise ValueError(f"sensitive path is not allowed: {relative.as_posix()}")

    return candidate
