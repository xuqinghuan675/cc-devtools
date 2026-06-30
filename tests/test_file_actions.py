from pathlib import Path
import tempfile
import unittest

from cc_devtools.file_actions import list_files, read_file


class FileActionTests(unittest.TestCase):
    def test_list_files_filters_common_generated_dirs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "src" / "CountrySelect.tsx").write_text("", encoding="utf-8")
            (root / "node_modules").mkdir()
            (root / "node_modules" / "package.js").write_text("", encoding="utf-8")

            files = list_files(root, "*.tsx")

            self.assertEqual(files, ["src/CountrySelect.tsx"])

    def test_read_file_returns_text_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "data").mkdir()
            (root / "data" / "countries.json").write_text('[{"code":"US"}]', encoding="utf-8")

            self.assertEqual(read_file("data/countries.json", root), '[{"code":"US"}]')

    def test_list_files_matches_case_insensitive_simple_glob(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "src" / "CountrySelect.tsx").write_text("", encoding="utf-8")

            files = list_files(root, "*countr*")

            self.assertEqual(files, ["src/CountrySelect.tsx"])

    def test_list_files_matches_root_filename(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "package.json").write_text("{}", encoding="utf-8")

            files = list_files(root, "package.json")

            self.assertEqual(files, ["package.json"])

    def test_list_files_accepts_absolute_pattern_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "src" / "app.py").write_text("", encoding="utf-8")

            files = list_files(root, str(root / "**" / "*.py"))

            self.assertEqual(files, ["src/app.py"])

    def test_read_file_rejects_outside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)

            with self.assertRaises(ValueError):
                read_file("../outside.txt", root)

    def test_read_file_rejects_sensitive_file_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".env").write_text("TOKEN=secret", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "sensitive"):
                read_file(".env", root)


if __name__ == "__main__":
    unittest.main()
