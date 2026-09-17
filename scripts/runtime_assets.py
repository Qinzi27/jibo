"""Shared source-only asset exclusions for browser and Android packaging."""
from pathlib import Path

# The approved high-resolution master lives in artwork/ for future exports.
# Guard against an accidental copy into web/; the old dumbbell favicon is retired.
SOURCE_ONLY_ASSETS = frozenset({'assets/jibo-blond-master.png', 'assets/icon.svg'})
RUNTIME_DOCUMENTS = frozenset({
    'index.html', 'styles.css', 'core.js', 'exercises.js', 'plans.js',
    'theory.js', 'app.js', 'sw.js', 'manifest.webmanifest',
})


def runtime_files(web: Path):
    files = []
    for path in sorted(web.rglob('*')):
        relative = path.relative_to(web)
        # Never follow an accidental link to private source, credentials or local data.
        if path.is_symlink():
            raise ValueError(f'Symlink is not a runtime asset: {relative}')
        if not path.is_file() or relative.as_posix() in SOURCE_ONLY_ASSETS:
            continue
        if any(part.startswith('.') for part in relative.parts):
            raise ValueError(f'Hidden file is not a runtime asset: {relative}')
        allowed = relative.as_posix() in RUNTIME_DOCUMENTS or (
            relative.parts[0] == 'assets' and path.suffix in {'.png', '.svg'}
        )
        if not allowed:
            raise ValueError(f'Unexpected file in runtime assets: {relative}')
        files.append(path)
    return files
