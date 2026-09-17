"""Shared source-only asset exclusions for browser and Android packaging."""
from pathlib import Path

# The approved high-resolution master lives in artwork/ for future exports.
# Guard against an accidental copy into web/; the old dumbbell favicon is retired.
SOURCE_ONLY_ASSETS = frozenset({'assets/jibo-blond-master.png', 'assets/icon.svg'})


def runtime_files(web: Path):
    return [path for path in sorted(web.rglob('*'))
            if path.is_file() and path.relative_to(web).as_posix() not in SOURCE_ONLY_ASSETS]
