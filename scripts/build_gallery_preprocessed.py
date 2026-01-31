#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys


def main() -> int:
    print(
        "Hinweis: scripts/build_gallery_preprocessed.py ist veraltet.\n"
        "Nutze stattdessen: python3 scripts/build_gallery_processed.py\n"
    )
    completed = subprocess.run([sys.executable, "scripts/build_gallery_processed.py"], check=False)
    return int(completed.returncode)


if __name__ == "__main__":
    raise SystemExit(main())

