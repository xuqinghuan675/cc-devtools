from pathlib import Path
import tempfile
import unittest

from cc_devtools.safety import resolve_write_path


class ResolveWritePathTests(unittest.TestCase):
    def test_relative_path_stays_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)

            resolved = resolve_write_path("nested/file.txt", root)

            self.assertEqual(resolved, root.resolve() / "nested" / "file.txt")

    def test_parent_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)

            with self.assertRaises(ValueError):
                resolve_write_path("../outside.txt", root)

    def test_absolute_path_outside_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            outside = root.parent / "outside.txt"

            with self.assertRaises(ValueError):
                resolve_write_path(str(outside), root)

    def test_empty_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                resolve_write_path("   ", Path(tmp))

    def test_dotenv_file_is_rejected_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, "sensitive"):
                resolve_write_path(".env", Path(tmp))

    def test_private_key_file_is_rejected_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)

            with self.assertRaisesRegex(ValueError, "sensitive"):
                resolve_write_path(root / "keys" / "id_ed25519", root)

    def test_git_config_is_rejected_inside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, "sensitive"):
                resolve_write_path(".git/config", Path(tmp))


if __name__ == "__main__":
    unittest.main()
