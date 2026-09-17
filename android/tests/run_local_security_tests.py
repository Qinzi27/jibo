#!/usr/bin/env python3
"""Test native URI and storage boundaries with JDK 17+, without Android or network."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
java_home = Path(os.environ['JAVA_HOME']) / 'bin' if os.environ.get('JAVA_HOME') else None
suffix = '.exe' if os.name == 'nt' else ''


def tool(name):
    found = java_home / (name + suffix) if java_home else None
    value = str(found) if found and found.is_file() else shutil.which(name)
    if not value:
        raise SystemExit('A working JDK 17+ is required; configure JAVA_HOME.')
    return value


with tempfile.TemporaryDirectory(prefix='jibo-local-security-') as directory:
    subprocess.run([tool('javac'), '-encoding', 'UTF-8', '-d', directory,
        str(root / 'android/app/src/main/java/app/leancrew/local/LocalSecurityPolicy.java'),
        str(root / 'android/tests/LocalSecurityPolicyTest.java')], check=True)
    subprocess.run([tool('java'), '-cp', directory, 'app.leancrew.local.LocalSecurityPolicyTest'], check=True)
