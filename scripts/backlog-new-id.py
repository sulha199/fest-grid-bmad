#!/usr/bin/env python3
"""Print a freshly minted backlog ID: `<TYPE>-<YYMMDD>-<3 random chars>`.

Usage:
    uv run --python 3.11 --with pyyaml scripts/backlog-new-id.py TYPE [--date YYYY-MM-DD]

TYPE is one of BUG, IDEA, CC, FIND (any case). The date defaults to today in UTC, so a
cloud session and a laptop agree. Pass `--date` for a retroactive row (`created` is then
that date). stdout is the ID and nothing else, so `$(...)` is safe.

The row's `created:` MUST equal the ID's date (check 17): copy it from the ID, never from
the clock. The ID avoids every ID in this tree, at the merge-base and on origin/master;
when git history is unavailable it says so on stderr and checks the tree only (CI's
check 17 is the backstop). See `backlog-spec.md` §4.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import sys

import backlog_ids

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARD = os.path.join(ROOT, "_bmad-output", "implementation-artifacts", "backlog.yaml")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("type", help="one of " + ", ".join(backlog_ids.TYPES))
    ap.add_argument("--date", help="creation date YYYY-MM-DD (default: today, UTC)")
    ap.add_argument("--board", default=BOARD, help=argparse.SUPPRESS)
    ap.add_argument("--repo", default=ROOT, help=argparse.SUPPRESS)
    args = ap.parse_args(argv)

    type_ = args.type.upper()
    if type_ not in backlog_ids.TYPES:
        print(f"unknown type {args.type!r}; expected one of {', '.join(backlog_ids.TYPES)}",
              file=sys.stderr)
        return 2
    try:
        day = dt.date.fromisoformat(args.date) if args.date else backlog_ids.utc_today()
    except ValueError:
        print(f"--date must be YYYY-MM-DD, got {args.date!r}", file=sys.stderr)
        return 2

    with open(args.board, encoding="utf-8") as fh:
        data, _ = backlog_ids.load_board_text(fh.read())
    remote = backlog_ids.load_remote_ids(args.repo, os.path.relpath(args.board, args.repo))
    if remote.problem:
        print(f"note: {remote.problem}; checked this tree only", file=sys.stderr)

    new_id = backlog_ids.mint_id(type_, day, backlog_ids.taken_ids(backlog_ids.item_ids(data), remote))
    print(f"created: {day.isoformat()}", file=sys.stderr)
    print(new_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
