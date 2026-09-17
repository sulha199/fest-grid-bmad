#!/usr/bin/env python3
"""Guardrail against `sprint-status.yaml`'s narrative-comment regrowth.

Context: `last_updated`'s trailing comment previously accumulated an
unbounded, ever-appended narrative (dev-story/create-story sessions kept
citing "per Story X's precedent" and matching whatever verbosity was
already there) until it reached 31.7KB / ~16.6% of the whole file -- read
in full up to 3x per `bmad-dev-story` dispatch. That history was moved to
`sprint-history.md` on 2026-09-17; see that file's header and
`bmad-dev-story`/`bmad-create-story`/`bmad-quick-dev`'s SKILL.md instructions
for the rule this enforces: `last_updated` gets a bare ISO timestamp only,
narrative goes in the story file's own Dev Notes/Change Log.

This script is a mechanical backstop, not a substitute for those
instructions -- prose rules get skipped under pressure; this doesn't.

Usage:
    uv run --python 3.11 scripts/sprint-status-comment-check.py [--max-len N]

Exit code is the number of offending comment lines (0 = clean), so it can
gate a commit the same way scripts/backlog-check.py does.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRINT_STATUS = os.path.join(ROOT, "_bmad-output", "implementation-artifacts", "sprint-status.yaml")

DEFAULT_MAX_LEN = 300

# Matches the comment portion of a line: a `#` not inside a quoted string.
# sprint-status.yaml's only quoted-string values are action_items[].description
# (double-quoted, no embedded `#`), so a plain "find the first unquoted #" is safe.
COMMENT_RE = re.compile(r"(?<!['\"])#(.*)$")


def find_offenders(path: str, max_len: int) -> list[tuple[int, int]]:
    offenders = []
    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            m = COMMENT_RE.search(line)
            if not m:
                continue
            comment_len = len(m.group(1).strip())
            if comment_len > max_len:
                offenders.append((lineno, comment_len))
    return offenders


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-len", type=int, default=DEFAULT_MAX_LEN, help=f"max allowed comment length in chars (default {DEFAULT_MAX_LEN})")
    parser.add_argument("--path", default=SPRINT_STATUS, help="path to sprint-status.yaml (default: this project's)")
    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"[sprint-status-comment-check] {args.path} does not exist -- nothing to check", file=sys.stderr)
        return 0

    offenders = find_offenders(args.path, args.max_len)
    if not offenders:
        print(f"[sprint-status-comment-check] clean -- no comment exceeds {args.max_len} chars")
        return 0

    print(f"[sprint-status-comment-check] {len(offenders)} comment(s) exceed {args.max_len} chars:", file=sys.stderr)
    for lineno, comment_len in offenders:
        print(f"  line {lineno}: {comment_len} chars", file=sys.stderr)
    print(
        "\nMove this narrative to the relevant story file's Dev Notes/Change Log "
        "(or sprint-history.md for genuinely cross-story history) and replace the "
        "comment with a short note or nothing at all. See this script's docstring "
        "for why this matters.",
        file=sys.stderr,
    )
    return len(offenders)


if __name__ == "__main__":
    sys.exit(main())
