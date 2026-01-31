#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="DEPRECATED: nutze scripts/build_gallery_processed.py")
    parser.add_argument("args", nargs=argparse.REMAINDER)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    _ = parse_args(argv)
    print(
        "Hinweis: scripts/convert_gallery_images_to_jpg.py ist veraltet.\n"
        "Nutze stattdessen: python3 scripts/build_gallery_processed.py\n"
    )
    completed = subprocess.run([sys.executable, "scripts/build_gallery_processed.py"], check=False)
    return int(completed.returncode)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
