"""Exercise the production packager with unwanted files and symlink escapes."""
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from runtime_assets import runtime_files


class RuntimePackagingSecurity(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='jibo-package-security-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'web'
        self.root.mkdir()

    def put(self, name):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('test fixture')
        return path

    def test_only_approved_runtime_documents_and_images(self):
        expected = [self.put(name) for name in ('index.html', 'app.js', 'assets/theory/a.png')]
        self.assertEqual(runtime_files(self.root), sorted(expected))

    def test_private_or_executable_extras_abort_packaging(self):
        for name in ('.env', '.env.production', 'key.keystore', 'data.json',
                     'AGENTS.md', 'assets/.secret.png', 'assets/extra.js', 'assets/data.html'):
            with self.subTest(name=name):
                path = self.put(name)
                with self.assertRaises(ValueError):
                    runtime_files(self.root)
                path.unlink()

    def test_file_symlink_cannot_escape_into_package(self):
        outside = Path(self.temporary.name) / 'private.txt'
        outside.write_text('private fixture')
        (self.root / 'app.js').symlink_to(outside)
        with self.assertRaises(ValueError):
            runtime_files(self.root)

    def test_directory_symlink_cannot_escape_into_package(self):
        outside = Path(self.temporary.name) / 'private'
        outside.mkdir()
        (self.root / 'assets').symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            runtime_files(self.root)

    def test_artwork_masters_are_excluded(self):
        self.put('assets/jibo-blond-master.png')
        self.put('assets/icon.svg')
        self.assertEqual(runtime_files(self.root), [])


if __name__ == '__main__':
    unittest.main()
