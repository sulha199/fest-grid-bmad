#!/usr/bin/env python3
"""Cheap heading outline + line-range lookup for large markdown files, so a
caller can read only the section it needs instead of loading the whole file.

Context: epics.md (4,390 lines) and the PRD (1,443 lines) are both read in
full by multiple bmad-* skills even when only one story's block or one
requirements section is actually relevant -- discover-inputs.md's Step 2b
("Try Whole Document") ignores any declared SELECTIVE_LOAD/INDEX_GUIDED
strategy and always full-loads an unsharded file. See sprint-history.md and
this project's ritual-token-usage investigation for the full writeup.

This script never prints file body content -- only heading text and the
line range each heading owns (from its own line to the line before the
next heading at the same-or-higher level, or EOF). The caller then does a
single targeted Read with that range's offset/limit.

epics.md is the clean case: 239 uniformly-formatted `### Story X.Y: ...` /
`### Epic N: ...` headings make `find` a deterministic key lookup, not a
relevance judgment -- no index.md or sharding needed. The PRD's headings
are more free-form, so `outline` (list everything, let the caller judge
relevance from heading text) is the more useful mode there.

Subcommands:
    outline PATH [--max-depth N]
        Print every heading up to depth N (default 6) as one line each:
        "{start}-{end}: {'#'*level} {heading text}". No body content.

    find PATTERN PATH [--all] [--max-depth N]
        Print the line range(s) of heading(s) matching PATTERN (a Python
        regex, searched against heading text only). Default: print just
        "{start}-{end}" for the first match (exit 1 if none). --all prints
        every match, one per line, same format as `outline`, and warns on
        stderr if multiple matches were found without --all.

Usage:
    uv run --python 3.11 scripts/md-outline.py outline epics.md --max-depth 3
    uv run --python 3.11 scripts/md-outline.py find "^Story 3\\.6h" epics.md
    uv run --python 3.11 scripts/md-outline.py find "^Epic 3:|^Story 3\\." epics.md --all

Exit codes: 0 success, 1 no match (find only), 2 usage/IO error.
"""
from __future__ import annotations

import argparse
import re
import sys

HEADING_RE = re.compile(r"^(#{1,6})\s+(\S.*?)\s*$")


def parse_headings(lines: list[str], max_depth: int) -> list[tuple[int, int, str]]:
    """Returns (line_no, level, text) for each ATX heading up to max_depth, 1-indexed."""
    headings = []
    for i, line in enumerate(lines, start=1):
        m = HEADING_RE.match(line)
        if m and len(m.group(1)) <= max_depth:
            headings.append((i, len(m.group(1)), m.group(2)))
    return headings


def compute_ranges(headings: list[tuple[int, int, str]], total_lines: int) -> list[tuple[int, int, int, str]]:
    """Returns (start, end, level, text) -- end is the line before the next
    heading at the same-or-shallower level, or the file's last line."""
    ranges = []
    for idx, (start, level, text) in enumerate(headings):
        end = total_lines
        for later_start, later_level, _ in headings[idx + 1 :]:
            if later_level <= level:
                end = later_start - 1
                break
        ranges.append((start, end, level, text))
    return ranges


def load_ranges(path: str, max_depth: int) -> list[tuple[int, int, int, str]]:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    headings = parse_headings(lines, max_depth)
    return compute_ranges(headings, len(lines))


def format_range(r: tuple[int, int, int, str]) -> str:
    start, end, level, text = r
    return f"{start}-{end}: {'#' * level} {text}"


def cmd_outline(args: argparse.Namespace) -> int:
    ranges = load_ranges(args.path, args.max_depth)
    if not ranges:
        print(f"[md-outline] no headings found (up to depth {args.max_depth}) in {args.path}", file=sys.stderr)
        return 0
    for r in ranges:
        print(format_range(r))
    return 0


def cmd_find(args: argparse.Namespace) -> int:
    ranges = load_ranges(args.path, args.max_depth)
    try:
        pattern = re.compile(args.pattern)
    except re.error as e:
        print(f"[md-outline] invalid regex `{args.pattern}`: {e}", file=sys.stderr)
        return 2
    matches = [r for r in ranges if pattern.search(r[3])]

    if not matches:
        print(f"[md-outline] no heading matches /{args.pattern}/ in {args.path}", file=sys.stderr)
        return 1

    if args.all:
        for r in matches:
            print(format_range(r))
        return 0

    if len(matches) > 1:
        print(
            f"[md-outline] {len(matches)} headings match /{args.pattern}/ -- printing the first; "
            "pass --all to list every match.",
            file=sys.stderr,
        )
    start, end, _, _ = matches[0]
    print(f"{start}-{end}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_outline = sub.add_parser("outline", help="list every heading with its line range")
    p_outline.add_argument("path")
    p_outline.add_argument("--max-depth", type=int, default=6)
    p_outline.set_defaults(func=cmd_outline)

    p_find = sub.add_parser("find", help="find heading(s) matching a regex, print line range(s)")
    p_find.add_argument("pattern")
    p_find.add_argument("path")
    p_find.add_argument("--max-depth", type=int, default=6)
    p_find.add_argument("--all", action="store_true", help="print every match instead of just the first")
    p_find.set_defaults(func=cmd_find)

    args = parser.parse_args()
    try:
        return args.func(args)
    except FileNotFoundError:
        print(f"[md-outline] file not found: {args.path}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
