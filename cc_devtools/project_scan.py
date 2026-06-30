import json
import os
from pathlib import Path


ENTRY_FILES = [
    "src/App.tsx",
    "src/App.jsx",
    "src/App.vue",
    "src/main.tsx",
    "src/main.jsx",
    "src/main.ts",
    "src/main.js",
    "src/pages/index.tsx",
    "src/app/page.tsx",
    "app/page.tsx",
    "pages/index.tsx",
    "src/index.tsx",
    "src/index.jsx",
    "index.html",
]

CONFIG_FILES = [
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.mjs",
    "webpack.config.js",
    "webpack.config.ts",
    "tsconfig.json",
    "jsconfig.json",
    "tailwind.config.js",
    "postcss.config.js",
]

KEY_DIRS = [
    "src",
    "app",
    "pages",
    "components",
    "src/components",
    "src/pages",
    "src/app",
    "src/routes",
    "src/router",
    "src/store",
    "src/stores",
    "src/services",
    "src/api",
    "src/lib",
    "public",
]

PACKAGE_LOCKS = [
    ("pnpm", "pnpm-lock.yaml"),
    ("yarn", "yarn.lock"),
    ("npm", "package-lock.json"),
    ("bun", "bun.lockb"),
]

SCAN_IGNORE_DIRS = {".git", "node_modules", "dist", "build", ".next", "coverage", "__pycache__"}
DATA_HINT_TOKENS = ("api", "service", "services", "data", "store", "mock", "fixture", "country", "countries")
DATA_HINT_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json"}
MAX_DATA_HINTS = 40
MAX_SCAN_DEPTH = 6


def _read_package_json(root):
    path = Path(root) / "package.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _deps(package):
    merged = {}
    for key in ("dependencies", "devDependencies"):
        value = package.get(key)
        if isinstance(value, dict):
            merged.update(value)
    return merged


def _existing_candidates(base, candidates):
    return [name for name in candidates if (base / name).exists()]


def _detect_package_manager(base):
    for name, lockfile in PACKAGE_LOCKS:
        if (base / lockfile).exists():
            return f"{name} ({lockfile})"
    return "Unknown"


def _relative(path, base):
    return path.relative_to(base).as_posix()


def _collect_data_hints(base):
    hints = []
    for root, dirs, files in os.walk(base):
        current = Path(root)
        rel_parts = current.relative_to(base).parts
        if len(rel_parts) > MAX_SCAN_DEPTH:
            dirs[:] = []
            continue

        dirs[:] = sorted(name for name in dirs if name not in SCAN_IGNORE_DIRS)
        for filename in sorted(files):
            path = current / filename
            rel = _relative(path, base)
            lower = rel.lower()
            if path.suffix.lower() not in DATA_HINT_EXTENSIONS:
                continue
            if not any(token in lower for token in DATA_HINT_TOKENS):
                continue
            hints.append(rel)
            if len(hints) >= MAX_DATA_HINTS:
                return hints
    return hints


def _detect_framework(deps):
    if "next" in deps:
        return "Next.js"
    if "react" in deps:
        return "React"
    if "vue" in deps:
        return "Vue"
    if "svelte" in deps or "@sveltejs/kit" in deps:
        return "Svelte"
    if "@angular/core" in deps:
        return "Angular"
    return "Unknown"


def _detect_bundler(root, deps):
    base = Path(root)
    if "vite" in deps or any((base / name).exists() for name in ("vite.config.ts", "vite.config.js")):
        return "Vite"
    if "next" in deps:
        return "Next.js"
    if "webpack" in deps or any((base / name).exists() for name in ("webpack.config.js", "webpack.config.ts")):
        return "Webpack"
    if "parcel" in deps:
        return "Parcel"
    return "Unknown"


def scan_frontend_project(root):
    base = Path(root).resolve()
    package = _read_package_json(base)
    deps = _deps(package)
    scripts = package.get("scripts") if isinstance(package.get("scripts"), dict) else {}
    existing_entries = _existing_candidates(base, ENTRY_FILES)
    existing_configs = _existing_candidates(base, CONFIG_FILES)
    existing_dirs = _existing_candidates(base, KEY_DIRS)
    data_hints = _collect_data_hints(base)

    lines = [
        "# Frontend Project Scan",
        f"Root: {base}",
        f"Framework: {_detect_framework(deps)}",
        f"Bundler: {_detect_bundler(base, deps)}",
        f"Package Manager: {_detect_package_manager(base)}",
        "",
        "## Scripts",
    ]

    if scripts:
        lines.extend(f"- {name}: {cmd}" for name, cmd in sorted(scripts.items()))
    else:
        lines.append("- (no package.json scripts found)")

    lines.extend(["", "## Entry Files"])
    if existing_entries:
        lines.extend(f"- {name}" for name in existing_entries)
    else:
        lines.append("- (no common frontend entry files found)")

    lines.extend(["", "## Config Files"])
    if existing_configs:
        lines.extend(f"- {name}" for name in existing_configs)
    else:
        lines.append("- (no common frontend config files found)")

    lines.extend(["", "## Key Directories"])
    if existing_dirs:
        lines.extend(f"- {name}" for name in existing_dirs)
    else:
        lines.append("- (no common frontend directories found)")

    lines.extend(["", "## Data/Service Candidates"])
    if data_hints:
        lines.extend(f"- {name}" for name in data_hints)
    else:
        lines.append("- (no obvious data, API, service, store, mock, or country files found)")

    lines.extend(["", "## Dependencies"])
    if deps:
        interesting = [name for name in sorted(deps) if name in {"react", "vue", "next", "vite", "webpack", "svelte", "@sveltejs/kit", "@angular/core", "typescript"}]
        lines.extend(f"- {name}: {deps[name]}" for name in interesting[:20])
    else:
        lines.append("- (no frontend dependencies found)")

    return "\n".join(lines)
