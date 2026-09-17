#!/usr/bin/env python3
"""Targeted read/write access to sprint-status.yaml's status fields --
without ever putting the file's ~40k-token content into a model's context.

Context: bmad-dev-story and bmad-create-story each require "Load the FULL
file" 2-3x per dispatch, purely to (a) find the first story/epic in a given
status, or (b) read/verify/update ONE key's status value. None of that
needs the whole file in context -- it needs one scan and one line edit.
Since every ritual dispatch is a fresh session with no cross-dispatch
caching, paying ~40k tokens per full load, 2-3x per dispatch, across a
batch of N stories is a direct, avoidable driver of high input-token
usage. See sprint-history.md and this project's CLAUDE.md-adjacent
ritual-token investigation for the full writeup.

This script never prints the file's content back to the caller (only a
key, a status, or a short confirmation line), and edits it with a single
targeted line substitution -- it does not parse or re-emit YAML, so every
comment, blank line, and section the file already has is left untouched
byte-for-byte except the one line being changed (plus the top-level
`last_updated:` timestamp, refreshed on every `set`).

Subcommands:
    next-with-status STATUS [--section development_status]
        Print the first key (in file order) under `development_status:`
        whose value equals STATUS, skipping `epic-*` and `*-retrospective`
        keys. Exit 1 with a message on stdout if none found.

    get KEY
        Print KEY's current status value. Exit 1 if KEY isn't found.

    set KEY NEW_STATUS [--expect STATUS] [--no-regress] [--no-timestamp]
        Update KEY's status value in place, preserving indentation and any
        trailing inline comment on that line untouched, then refresh
        `last_updated:` to now (bare ISO8601 timestamp, no comment -- see
        sprint-history.md for why that matters).

        --expect STATUS: verify KEY's current value equals STATUS first;
            exit 2 with a clear message if not (replaces the workflow's
            prose "verify current status is X" step with something that
            can't be silently skipped).
        --no-regress: skip the write (exit 0) if KEY's current status is
            already at or past NEW_STATUS in the standard lifecycle order
            (backlog < ready-for-dev < in-progress < review < done).
            Mirrors bmad-quick-dev's sync-sprint-status.md idempotency
            rule: never regress a story's status.

Usage:
    uv run --python 3.11 scripts/sprint-status-tool.py next-with-status ready-for-dev
    uv run --python 3.11 scripts/sprint-status-tool.py get 3-6h-some-story
    uv run --python 3.11 scripts/sprint-status-tool.py set 3-6h-some-story in-progress --expect ready-for-dev

Exit codes: 0 success/found, 1 not found, 2 --expect mismatch, 3 usage/IO error.
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRINT_STATUS = os.path.join(ROOT, "_bmad-output", "implementation-artifacts", "sprint-status.yaml")

STATUS_RANK = {
    "backlog": 0,
    "contexted": 0,  # legacy synonym for backlog-ish, per bmad-create-story's back-compat handling
    "ready-for-dev": 1,
    "in-progress": 2,
    "review": 3,
    "done": 4,
}

ENTRY_RE = re.compile(r"^(\s*)([A-Za-z0-9][\w.-]*):\s*(\S+)\s*(#.*)?$")
LAST_UPDATED_RE = re.compile(r"^last_updated:\s*(\S+)\s*(#.*)?$")
SECTION_HEADER_RE = re.compile(r"^([A-Za-z0-9_]+):\s*$")


def is_skippable_key(key: str) -> bool:
    # Epic keys are "epic-N", "epic-N-retrospective", or "epic-N-iM" (sub-epics,
    # e.g. "epic-0-i5") -- all start with the literal "epic" prefix. Retrospective
    # keys always end "-retrospective". Story keys never do either.
    return key.startswith("epic") or key.endswith("-retrospective")


def read_lines(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        return f.readlines()


def write_lines(path: str, lines: list[str]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)


def find_section_bounds(lines: list[str], section: str) -> tuple[int, int]:
    """Returns (start, end) line indices (0-based, end exclusive) of `section:`'s
    body -- from the line after `section:` up to (not including) the next
    top-level (zero-indent) `key:` line, or EOF."""
    start = None
    for i, line in enumerate(lines):
        if line.rstrip("\n") == f"{section}:":
            start = i + 1
            break
    if start is None:
        raise KeyError(f"no top-level `{section}:` key found")
    end = len(lines)
    for i in range(start, len(lines)):
        if SECTION_HEADER_RE.match(lines[i]) and not lines[i].startswith((" ", "\t")):
            end = i
            break
    return start, end


def cmd_next_with_status(args: argparse.Namespace) -> int:
    lines = read_lines(args.path)
    start, end = find_section_bounds(lines, args.section)
    for line in lines[start:end]:
        m = ENTRY_RE.match(line)
        if not m:
            continue
        key, value = m.group(2), m.group(3)
        if is_skippable_key(key):
            continue
        if value == args.status:
            print(key)
            return 0
    print(f"[sprint-status-tool] no key in `{args.section}` has status `{args.status}`", file=sys.stderr)
    return 1


def find_entry_line(lines: list[str], key: str) -> tuple[int, str, str] | None:
    for i, line in enumerate(lines):
        m = ENTRY_RE.match(line)
        if m and m.group(2) == key:
            return i, m.group(3), m.group(4) or ""
    return None


def cmd_get(args: argparse.Namespace) -> int:
    lines = read_lines(args.path)
    found = find_entry_line(lines, args.key)
    if found is None:
        print(f"[sprint-status-tool] key `{args.key}` not found", file=sys.stderr)
        return 1
    _, value, _ = found
    print(value)
    return 0


def refresh_last_updated(lines: list[str]) -> bool:
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for i, line in enumerate(lines):
        m = LAST_UPDATED_RE.match(line)
        if m:
            lines[i] = f"last_updated: {now}\n"
            return True
    return False


def cmd_set(args: argparse.Namespace) -> int:
    lines = read_lines(args.path)
    found = find_entry_line(lines, args.key)
    if found is None:
        print(f"[sprint-status-tool] key `{args.key}` not found", file=sys.stderr)
        return 1
    idx, current_value, trailing_comment = found

    if args.expect is not None and current_value != args.expect:
        print(
            f"[sprint-status-tool] expected `{args.key}` to be `{args.expect}` but it is `{current_value}` -- "
            "not updating. Re-check sprint-status.yaml state before retrying (it may have changed from "
            "parallel activity).",
            file=sys.stderr,
        )
        return 2

    if args.no_regress:
        cur_rank = STATUS_RANK.get(current_value)
        new_rank = STATUS_RANK.get(args.new_status)
        if cur_rank is not None and new_rank is not None and cur_rank >= new_rank:
            print(f"[sprint-status-tool] `{args.key}` already at `{current_value}` (>= `{args.new_status}`) -- no change")
            return 0

    if current_value == args.new_status:
        print(f"[sprint-status-tool] `{args.key}` already `{args.new_status}` -- no change")
        return 0

    line = lines[idx]
    m = ENTRY_RE.match(line)
    indent = m.group(1)
    comment_part = f" {trailing_comment}" if trailing_comment else ""
    lines[idx] = f"{indent}{args.key}: {args.new_status}{comment_part}\n"

    if not args.no_timestamp:
        refresh_last_updated(lines)

    write_lines(args.path, lines)
    print(f"[sprint-status-tool] `{args.key}`: `{current_value}` -> `{args.new_status}`")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--path", default=SPRINT_STATUS, help="path to sprint-status.yaml (default: this project's)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_next = sub.add_parser("next-with-status", help="find the first key in file order with the given status")
    p_next.add_argument("status")
    p_next.add_argument("--section", default="development_status")
    p_next.set_defaults(func=cmd_next_with_status)

    p_get = sub.add_parser("get", help="print a key's current status")
    p_get.add_argument("key")
    p_get.set_defaults(func=cmd_get)

    p_set = sub.add_parser("set", help="update a key's status in place")
    p_set.add_argument("key")
    p_set.add_argument("new_status")
    p_set.add_argument("--expect", default=None, help="fail (exit 2) unless the current value equals this")
    p_set.add_argument("--no-regress", action="store_true", help="skip the write if current status is already >= new_status in the standard lifecycle order")
    p_set.add_argument("--no-timestamp", action="store_true", help="don't refresh last_updated")
    p_set.set_defaults(func=cmd_set)

    args = parser.parse_args()
    if not os.path.exists(args.path):
        print(f"[sprint-status-tool] {args.path} does not exist", file=sys.stderr)
        return 3
    try:
        return args.func(args)
    except KeyError as e:
        print(f"[sprint-status-tool] {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
