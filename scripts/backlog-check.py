#!/usr/bin/env python3
"""Deterministic runner for the backlog board's integrity checks and lenses.

Implements checks 1-11 and the lens table from
`_bmad-output/implementation-artifacts/backlog-spec.md` (checks 10-11 cover epic
formation, `planning-artifacts/epic-formation-gate.md`). `bmad-sprint-status` runs
this rather than re-deriving the checks from prose each session: a subtly wrong
reimplementation reports "clean" on a broken board, which is worse than no check.

Usage:
    uv run --python 3.11 --with pyyaml scripts/backlog-check.py [--lens NAME] [--quiet]

Exit code is the number of check failures (0 = clean), so it can gate a commit.
"""
from __future__ import annotations
import argparse, os, re, sys
from collections import defaultdict

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMPL = os.path.join(ROOT, "_bmad-output", "implementation-artifacts")
BOARD = os.path.join(IMPL, "backlog.yaml")
SPRINT = os.path.join(IMPL, "sprint-status.yaml")

# Spec §3 enums and §5 vocabulary. Keep in sync with backlog-spec.md.
IMPACTS = {"user-visible", "compliance", "latent", "cosmetic", "internal"}
EFFORTS = {"xs", "s", "m", "l"}
OPEN = {"backlog", "triaged", "promoted"}
UNPROMOTED = {"backlog", "triaged"}
ITEM_TERMINAL = {"done", "skipped", "superseded"}
STORY_TERMINAL = {"done", "wont-do"}


def load_board():
    with open(BOARD, encoding="utf-8") as fh:
        board = yaml.safe_load(fh)
    tags = {f"{ns}:{s}" for ns, slices in board["tags"].items() for s in slices}
    return board["items"], tags


def load_sprint_status():
    """Story key -> status. Two-space-indented scalars under development_status."""
    status = {}
    with open(SPRINT, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"^\s{2}([A-Za-z0-9][A-Za-z0-9_.\-]*):\s*([a-z\-]+)\s*$", line)
            if m:
                status[m.group(1)] = m.group(2)
    return status


def resolve_ref(ref: str) -> str:
    # §4: ref paths are relative to _bmad-output/, except backlog/… which is
    # relative to implementation-artifacts/.
    if ref.startswith("backlog/"):
        return os.path.join(IMPL, ref)
    return os.path.join(ROOT, "_bmad-output", ref)


def tag_prefix(tag: str) -> str:
    return tag.split("/", 1)[0]


def run_checks(items, tags, stories):
    failures = []

    def fail(num, row, msg):
        failures.append((num, row, msg))

    # A ref shared by many rows (the evidence files) cannot carry one row's
    # backlog_id, so check 2 only applies to refs a single row owns.
    ref_owners = defaultdict(list)
    for key, row in items.items():
        for ref in row.get("ref") or []:
            ref_owners[ref].append(key)

    for key, row in items.items():
        status = row.get("status")

        for ref in row.get("ref") or []:
            path = resolve_ref(ref)
            if not os.path.exists(path):
                fail(1, key, f"broken ref: {ref}")
                continue
            if len(ref_owners[ref]) > 1:
                continue  # shared evidence file; check 2 does not apply
            with open(path, encoding="utf-8") as fh:
                head = fh.read(400)
            m = re.search(r"^backlog_id:\s*(\S+)", head, re.M)
            if not m:
                fail(2, key, f"{ref} carries no backlog_id")
            elif m.group(1) != key:
                fail(2, key, f"{ref} says backlog_id: {m.group(1)}")

        for tag in row.get("touches") or []:
            if tag_prefix(tag) not in tags:
                fail(3, key, f"unregistered tag: {tag}")

        row_stories = row.get("stories") or []
        for story in row_stories:
            if story not in stories:
                fail(4, key, f"story not in sprint-status.yaml: {story}")

        if row_stories:
            derived = "done" if all(
                stories.get(s) in STORY_TERMINAL for s in row_stories
            ) else "promoted"
            if status != derived:
                seen = sorted({stories.get(s) for s in row_stories})
                fail(5, key, f"status {status!r} but stories derive {derived!r} ({seen})")

        parent = row.get("parent")
        if parent and parent not in items:
            fail(6, key, f"orphan parent: {parent}")
        if parent and parent in items:
            if status in OPEN and items[parent].get("status") == "done":
                fail(6, key, f"open child of done parent {parent}")

        # Check 8 — ranking is required only on open, un-promoted rows.
        if status in UNPROMOTED and not row_stories:
            if row.get("impact") not in IMPACTS:
                fail(8, key, f"impact missing or invalid: {row.get('impact')!r}")
            if row.get("effort") not in EFFORTS:
                fail(8, key, f"effort missing or invalid: {row.get('effort')!r}")

        for blocked in row.get("blocks") or []:
            if blocked not in items:
                fail(9, key, f"blocks a nonexistent id: {blocked}")
            elif items[blocked].get("status") in ITEM_TERMINAL:
                fail(9, key, f"blocks {blocked}, already {items[blocked]['status']}")

        if status == "superseded" and not row.get("superseded_by"):
            fail(5, key, "status superseded but no superseded_by")

        # Checks 10-11 — epic formation (epic-formation-gate.md).
        epic = row.get("epic")
        if epic:
            if epic not in epics(stories):
                fail(10, key, f"epic not in sprint-status.yaml: {epic}")
            elif IMPROVEMENT_EPIC.match(epic) and not any(
                epic_story_letter(epic, s) == "z" for s in stories
            ):
                fail(11, key, f"improvement epic {epic} has no z (ratchet) story")

    return failures


# §9 check 11 — `epic-0-i1` owns stories `0-i1a-…` through `0-i1z-…`.
IMPROVEMENT_EPIC = re.compile(r"^epic-(\d+)-i(\d+)$")


def epics(stories):
    return {k for k in stories if k.startswith("epic-")}


def epic_story_letter(epic: str, story: str) -> str | None:
    """The story's letter within `epic`, or None if it belongs to another epic."""
    m = IMPROVEMENT_EPIC.match(epic)
    if not m:
        return None
    n, k = m.groups()
    hit = re.match(rf"^{n}-i{k}([a-z])-", story)
    return hit.group(1) if hit else None


def collisions(items):
    """Check 7 — ascending by size, groups larger than 4 suppressed."""
    groups = defaultdict(set)
    for key, row in items.items():
        if row.get("status") in OPEN:
            for tag in row.get("touches") or []:
                groups[tag_prefix(tag)].add(key)
    shown, suppressed = [], 0
    for tag, members in groups.items():
        if len(members) < 2:
            continue
        if len(members) > 4:
            suppressed += 1
        else:
            shown.append((len(members), tag, sorted(members)))
    return sorted(shown), suppressed


def lenses(items):
    """Spec §11. Definitions live in the spec; this mirrors them."""
    def touches(row, prefix):
        return any(t == prefix or t.startswith(prefix + "/")
                   for t in row.get("touches") or [])

    blocked_ids = {b for r in items.values() if r.get("status") in OPEN
                   for b in r.get("blocks") or []}

    def close_out(key, row):
        st = row.get("stories") or []
        return bool(st) and row.get("status") == "promoted" and all(
            SPRINT_STATUS.get(s) == "review" for s in st)

    return {
        "unblock": lambda k, r: k in blocked_ids,
        "cheap-wins": lambda k, r: r.get("status") == "backlog"
            and r.get("effort") in {"xs", "s"}
            and r.get("impact") in {"user-visible", "cosmetic"},
        "stability": lambda k, r: r.get("status") == "backlog"
            and r.get("impact") == "user-visible"
            and r.get("type") in {"bug", "finding"},
        "legal": lambda k, r: r.get("impact") == "compliance"
            or (touches(r, "cross:ai-extraction") and r.get("status") in OPEN),
        "demo-polish": lambda k, r: (touches(r, "cross:ux-tokens") or touches(r, "web:events"))
            and r.get("impact") in {"user-visible", "cosmetic"},
        "close-out": close_out,
        "truth-debt": lambda k, r: r.get("impact") == "internal"
            and r.get("type") == "finding",
    }


def main():
    global SPRINT_STATUS
    ap = argparse.ArgumentParser()
    ap.add_argument("--lens", help="print one lens instead of the full report")
    ap.add_argument("--quiet", action="store_true", help="failures only")
    args = ap.parse_args()

    items, tags = load_board()
    SPRINT_STATUS = load_sprint_status()

    lens_table = lenses(items)
    if args.lens:
        if args.lens not in lens_table:
            print(f"unknown lens {args.lens!r}; known: {', '.join(lens_table)}")
            return 1
        fn = lens_table[args.lens]
        for key in sorted(k for k, r in items.items() if fn(k, r)):
            r = items[key]
            print(f"{key:9} {r.get('impact','-'):13} {r.get('effort','-'):3} {r['title']}")
        return 0

    failures = run_checks(items, tags, SPRINT_STATUS)
    if failures:
        print("CHECK FAILURES")
        for num, row, msg in sorted(failures):
            print(f"  check {num}  [{row}] {msg}")
    else:
        print("checks 1-11: clean")

    if args.quiet:
        return len(failures)

    by_status, by_type = defaultdict(int), defaultdict(int)
    for row in items.values():
        by_status[row.get("status")] += 1
        by_type[row.get("type")] += 1
    print(f"\nrows: {len(items)}")
    print("  status:", dict(sorted(by_status.items())))
    print("  type:  ", dict(sorted(by_type.items())))

    shown, suppressed = collisions(items)
    print("\ncollisions (check 7, groups <=4, ascending):")
    for size, tag, members in shown:
        print(f"  {tag:24} {size}  {', '.join(members)}")
    print(f"  [{suppressed} groups larger than 4 suppressed]")

    print("\nlenses (§11):")
    for name, fn in lens_table.items():
        hits = sorted(k for k, r in items.items() if fn(k, r))
        if hits:
            print(f"  {name:12} ({len(hits):2})  {', '.join(hits)}")

    return len(failures)


if __name__ == "__main__":
    sys.exit(main())
