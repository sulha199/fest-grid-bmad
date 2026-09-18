#!/usr/bin/env python3
"""Guardrail against backlog.yaml's narrative-field regrowth.

Context: `last_updated` (a top-level scalar) previously accumulated an
unbounded, ever-appended narrative -- the same pattern already found and
fixed in sprint-status.yaml (see sprint-history.md) -- until it reached
35KB / ~14% of the whole file, read in full by every skill that consults
the board (bmad-sprint-status, bmad-form-epics, bmad-correct-course, and
more). That history was moved to backlog-history.md on 2026-09-18; see
backlog-spec.md's "Top-level metadata" section for the rule this enforces:
`last_updated` is a bare YYYY-MM-DD value, nothing else.

The same investigation found individual rows' `note` field carrying the
identical anti-pattern -- backlog-spec.md's Field reference already says
`note` is "One line. Only for a fact that changes how the row is read.
Not a description," but nothing was checking it. This script checks both.

This is a mechanical backstop, not a substitute for backlog-spec.md's own
rule -- prose rules get skipped under pressure; this doesn't.

Usage:
    uv run --python 3.11 --with pyyaml scripts/backlog-history-check.py [--max-len N]

Exit code is the number of offending fields (0 = clean), so it can gate a
commit the same way scripts/backlog-check.py does.
"""
from __future__ import annotations

import argparse
import os
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKLOG = os.path.join(ROOT, "_bmad-output", "implementation-artifacts", "backlog.yaml")

DEFAULT_MAX_LEN = 120  # generous for "YYYY-MM-DD -- short reason", well short of a paragraph


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-len", type=int, default=DEFAULT_MAX_LEN, help=f"max allowed field length in chars (default {DEFAULT_MAX_LEN})")
    parser.add_argument("--path", default=BACKLOG, help="path to backlog.yaml (default: this project's)")
    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"[backlog-history-check] {args.path} does not exist -- nothing to check", file=sys.stderr)
        return 0

    with open(args.path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    offenders: list[tuple[str, int]] = []

    last_updated = data.get("last_updated")
    if isinstance(last_updated, str) and len(last_updated) > args.max_len:
        offenders.append(("last_updated", len(last_updated)))

    for item_id, row in (data.get("items") or {}).items():
        note = row.get("note") if isinstance(row, dict) else None
        if isinstance(note, str) and len(note) > args.max_len:
            offenders.append((f"items.{item_id}.note", len(note)))

    if not offenders:
        print(f"[backlog-history-check] clean -- no field exceeds {args.max_len} chars")
        return 0

    print(f"[backlog-history-check] {len(offenders)} field(s) exceed {args.max_len} chars:", file=sys.stderr)
    for name, length in offenders:
        print(f"  {name}: {length} chars", file=sys.stderr)
    print(
        "\nMove this narrative to the item's own tier-1/tier-2 file (backlog/<ID>-<slug>.md "
        "or the sprint-change-proposal) and replace the field with a short note or nothing "
        "at all. See backlog-spec.md's \"Top-level metadata\" section and the `note` row in "
        "the Field reference for why this matters.",
        file=sys.stderr,
    )
    return len(offenders)


if __name__ == "__main__":
    sys.exit(main())
