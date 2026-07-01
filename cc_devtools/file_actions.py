import fnmatch
import json
from pathlib import Path

try:
    from .safety import resolve_write_path
except ImportError:
    from safety import resolve_write_path


EXCLUDED_DIRS = {".git", "node_modules", "dist", "build", "__pycache__"}
MAX_FILES = 200
MAX_READ_CHARS = 20000
MAX_READ_LIMIT = 100000


def _is_excluded(path):
    return any(part in EXCLUDED_DIRS or part.endswith(".egg-info") for part in path.parts)


def _normalize_pattern(base, pattern):
    query = (pattern or "**/*").strip() or "**/*"
    query_path = Path(query)
    if query_path.is_absolute():
        try:
            query = query_path.resolve().relative_to(base).as_posix()
        except ValueError as e:
            raise ValueError("file list pattern is outside allowed root") from e
        return query or "**/*"
    return query


def list_files(root, pattern="**/*"):
    base = Path(root).resolve()
    query = _normalize_pattern(base, pattern)
    simple_query = "/" not in query and "\\" not in query
    if query in {"*", "*.*"}:
        simple_query = False
        query = "**/*"
    candidates = base.rglob("*") if simple_query else base.glob(query)

    results = []
    for candidate in candidates:
        if len(results) >= MAX_FILES:
            break
        if not candidate.is_file():
            continue
        rel = candidate.relative_to(base)
        if _is_excluded(rel):
            continue
        rel_text = rel.as_posix()
        if simple_query and not (
            fnmatch.fnmatch(rel_text.lower(), f"**/{query.lower()}")
            or fnmatch.fnmatch(rel_text.lower(), query.lower())
            or fnmatch.fnmatch(rel.name.lower(), query.lower())
        ):
            continue
        results.append(rel_text)

    return sorted(results)


def _clamp_int(value, default, minimum, maximum):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return min(max(parsed, minimum), maximum)


def _format_next_read_action(path, offset, limit):
    payload = json.dumps(
        {"path": str(path), "offset": offset, "limit": limit},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return f"Next: [ACTION:file:read]{payload}[/ACTION]"


def read_file(path, root, offset=0, limit=MAX_READ_CHARS):
    file_path = resolve_write_path(path, root)
    if not file_path.is_file():
        raise ValueError(f"file not found: {path}")
    content = file_path.read_text(encoding="utf-8", errors="replace")
    total = len(content)
    start = _clamp_int(offset, 0, 0, total)
    read_limit = _clamp_int(limit, MAX_READ_CHARS, 1, MAX_READ_LIMIT)
    end = min(start + read_limit, total)
    page = content[start:end]

    if end < total:
        return (
            f"{page}\n"
            f"[truncated at {end} of {total} chars]\n"
            f"{_format_next_read_action(path, end, read_limit)}"
        )
    if start > 0:
        return f"[file page {start}-{end} of {total} chars]\n{page}"
    return page
