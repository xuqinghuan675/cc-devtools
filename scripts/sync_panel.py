from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension" / "panel"
TARGET = ROOT / "cc_devtools" / "extension" / "panel"


def sync_panel() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for source_path in SOURCE.iterdir():
        if source_path.is_file():
            shutil.copy2(source_path, TARGET / source_path.name)


if __name__ == "__main__":
    sync_panel()
