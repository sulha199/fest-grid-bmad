#!/usr/bin/env python3
"""The one home for backlog ID rules (`backlog-spec.md` §4 and check 17).

Importable by `backlog-check.py`, `backlog-new-id.py` and the tests; it is not a CLI.
`backlog-spec.md` is authoritative: it cites `LEGACY_CEILING`, `SUFFIX_LEN` and the two
patterns by name, so a number lives here and nowhere else.

Two ID shapes are valid:

* legacy `TYPE-NNN` (`FIND-127`). The set is FROZEN: no new legacy ID may be added.
* new `TYPE-YYMMDD-xxx` (`FIND-261108-k3x`): the creation date (UTC) plus `SUFFIX_LEN`
  random characters from `SUFFIX_ALPHABET`. Minted with no shared state.

Why a check is needed at all: two branches that each append a row end up, after a clean
git merge, as two rows with one key in one file, and `yaml.safe_load` silently keeps the
last. `load_board_text` therefore reports duplicate keys instead of overwriting.
"""
from __future__ import annotations

import datetime as _dt
import re
import secrets
import string
import subprocess
from dataclasses import dataclass

import yaml

TYPES = ("BUG", "IDEA", "CC", "FIND")

# Highest legacy number per type when the scheme changed (2026-11-08). Only the no-git
# fallback: with git, the merge-base rule below is stricter and never drifts.
LEGACY_CEILING = {"BUG": 99, "IDEA": 113, "CC": 32, "FIND": 127}

SUFFIX_ALPHABET = string.ascii_lowercase + string.digits
SUFFIX_LEN = 3

LEGACY_RE = re.compile(r"^(BUG|IDEA|CC|FIND)-(\d{3})$")
NEW_RE = re.compile(r"^(BUG|IDEA|CC|FIND)-(\d{6})-([a-z0-9]{%d})$" % SUFFIX_LEN)

MASTER_REF = "origin/master"
MINT_ATTEMPTS = 1000


@dataclass(frozen=True)
class BacklogId:
    raw: str
    type: str
    kind: str  # "legacy" | "new"
    number: int = 0  # legacy only
    yymmdd: str = ""  # new only
    suffix: str = ""  # new only


def parse_id(raw) -> BacklogId | None:
    """The parsed ID, or None when `raw` is neither a legacy nor a new-format ID."""
    if not isinstance(raw, str):
        return None
    m = LEGACY_RE.match(raw)
    if m:
        return BacklogId(raw, m.group(1), "legacy", number=int(m.group(2)))
    m = NEW_RE.match(raw)
    if m:
        return BacklogId(raw, m.group(1), "new", yymmdd=m.group(2), suffix=m.group(3))
    return None


def yymmdd_to_date(yymmdd: str) -> _dt.date | None:
    """`261108` -> 2026-11-08; None for an impossible calendar date (month 13, 30 Feb)."""
    try:
        return _dt.date(2000 + int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6]))
    except (ValueError, IndexError):
        return None


def id_sort_key(raw) -> tuple:
    """Group by type; legacy first by number, then new by date and suffix.

    The suffix is random, so order within one day carries no meaning, only the date does.
    An unparseable ID sorts last so it is never hidden among valid ones.
    """
    parsed = parse_id(raw)
    if parsed is None:
        return (1, str(raw), 0, 0, "", "")
    if parsed.kind == "legacy":
        return (0, parsed.type, 0, parsed.number, "", "")
    return (0, parsed.type, 1, 0, parsed.yymmdd, parsed.suffix)


def utc_today() -> _dt.date:
    return _dt.datetime.now(_dt.timezone.utc).date()


def mint_id(type_: str, day: _dt.date, taken, choose=secrets.choice) -> str:
    """A new-format ID for `day` that is not in `taken` (re-rolls the suffix on a hit)."""
    if type_ not in TYPES:
        raise ValueError(f"unknown type {type_!r}; expected one of {', '.join(TYPES)}")
    prefix = f"{type_}-{day:%y%m%d}-"
    for _ in range(MINT_ATTEMPTS):
        candidate = prefix + "".join(choose(SUFFIX_ALPHABET) for _ in range(SUFFIX_LEN))
        if candidate not in taken:
            return candidate
    raise RuntimeError(f"no free suffix for {prefix} after {MINT_ATTEMPTS} attempts")


# ── duplicate-aware YAML loading ────────────────────────────────────────────────────────

class _DuplicateKeyLoader(yaml.SafeLoader):
    """SafeLoader that records every repeated key in ANY mapping instead of overwriting."""

    def __init__(self, stream):
        super().__init__(stream)
        self.duplicates: list[tuple[object, int, int]] = []


def _construct_mapping(loader, node, deep=False):
    seen: dict = {}
    for key_node, _ in node.value:
        try:
            key = loader.construct_object(key_node, deep=True)
            hash(key)
        except Exception:  # an unhashable or odd key: leave it to the normal constructor
            continue
        line = key_node.start_mark.line + 1
        if key in seen:
            loader.duplicates.append((key, seen[key], line))
        else:
            seen[key] = line
    return yaml.SafeLoader.construct_mapping(loader, node, deep=deep)


_DuplicateKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping
)


def load_board_text(text: str):
    """`(data, duplicates)`; each duplicate is `(key, first_line, repeat_line)`."""
    loader = _DuplicateKeyLoader(text)
    try:
        data = loader.get_single_data()
    finally:
        loader.dispose()
    return data, loader.duplicates


def item_ids(data) -> frozenset:
    items = (data or {}).get("items") or {}
    return frozenset(str(k) for k in items)


# ── what git knows ──────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RemoteIds:
    """IDs at the merge-base and on origin/master; `problem` says why they are unknown."""

    base: frozenset | None = None
    master: frozenset | None = None
    problem: str = ""


def _git(repo: str, *args: str) -> str | None:
    try:
        done = subprocess.run(
            ["git", "-C", repo, *args], capture_output=True, text=True, check=False
        )
    except OSError:
        return None
    return done.stdout if done.returncode == 0 else None


def _ids_at(repo: str, ref: str, board_rel: str) -> frozenset | None:
    """IDs of the board at `ref`; an absent file is an empty board, a bad file is None."""
    if _git(repo, "cat-file", "-e", f"{ref}:{board_rel}") is None:
        # Non-zero: either the ref is unknown (a problem) or the file is absent (an empty board).
        if _git(repo, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}") is None:
            return None
        return frozenset()
    text = _git(repo, "show", f"{ref}:{board_rel}")
    if text is None:
        return None
    try:
        data, _ = load_board_text(text)
    except yaml.YAMLError:
        return None
    return item_ids(data)


def load_remote_ids(repo: str, board_rel: str, master_ref: str = MASTER_REF) -> RemoteIds:
    if _git(repo, "rev-parse", "--verify", "--quiet", f"{master_ref}^{{commit}}") is None:
        return RemoteIds(problem=f"{master_ref} is not available (no remote, or a shallow "
                                 f"checkout: run `git fetch origin master`)")
    base_sha = (_git(repo, "merge-base", "HEAD", master_ref) or "").strip()
    if not base_sha:
        return RemoteIds(problem=f"no merge-base between HEAD and {master_ref} (shallow "
                                 f"clone? fetch more history, e.g. `git fetch --unshallow`)")
    base = _ids_at(repo, base_sha, board_rel)
    master = _ids_at(repo, master_ref, board_rel)
    if base is None or master is None:
        return RemoteIds(problem=f"could not read {board_rel} at the merge-base or {master_ref}")
    return RemoteIds(base=base, master=master)


def taken_ids(tree_ids, remote: RemoteIds) -> frozenset:
    """Every ID a new one must avoid: this tree, the merge-base and origin/master."""
    taken = set(tree_ids)
    for part in (remote.base, remote.master):
        if part:
            taken |= part
    return frozenset(taken)


# ── check 17 ────────────────────────────────────────────────────────────────────────────

def _rename_recipe(parsed: BacklogId | None, key) -> str:
    if parsed is None:
        return "remove the repeated key"
    return (f"keep one row and re-mint the other with `scripts/backlog-new-id.py {parsed.type} "
            f"--date <its created date>`, then fix its parent/blocks/superseded_by, "
            f"backlog_id and backlog/<ID>-<slug>.md references")


def check_ids(items, duplicates=(), remote: RemoteIds | None = None,
              require_remote: bool = False):
    """Check 17. Returns `(findings, warnings)`; each finding is `(row, message)`.

    `items` is the loaded `items:` mapping. `duplicates` come from `load_board_text`.
    `remote` is what git knows; None means "not looked up" and is treated as unavailable.
    """
    findings: list[tuple[str, str]] = []
    warnings: list[str] = []
    remote = remote or RemoteIds(problem="git history was not consulted")
    have_git = remote.base is not None and remote.master is not None
    tree = frozenset(str(k) for k in items)

    for key, first, again in duplicates:
        row = str(key) if parse_id(key) else "-"
        findings.append((row, f"duplicate key {key!r} at lines {first} and {again}: "
                              f"{_rename_recipe(parse_id(key), key)}"))

    for key, row in items.items():
        parsed = parse_id(key)
        if parsed is None:
            findings.append((str(key), f"malformed ID {key!r}: expected legacy TYPE-NNN "
                                       f"(frozen) or TYPE-YYMMDD-xxx ({SUFFIX_LEN} chars a-z0-9)"))
            continue

        if parsed.kind == "new":
            day = yymmdd_to_date(parsed.yymmdd)
            if day is None:
                findings.append((key, f"ID date {parsed.yymmdd} is not a real calendar date"))
            else:
                created = str((row or {}).get("created"))
                if created != day.isoformat():
                    findings.append((key, f"ID date is {day.isoformat()} but created is "
                                          f"{created}: derive `created` from the ID, not the clock"))
            continue

        # Legacy shape: frozen. With git, a legacy key must already exist at the merge-base
        # (this also catches reuse of an unused gap such as IDEA-074); without git the
        # per-type ceiling is the fallback.
        helper = f"scripts/backlog-new-id.py {parsed.type}"
        if have_git:
            if key not in remote.base:
                findings.append((key, f"legacy-format ID is not at the merge-base: legacy "
                                      f"counters are frozen, mint a new one with `{helper}`"))
        elif parsed.number > LEGACY_CEILING[parsed.type]:
            findings.append((key, f"legacy-format ID above the frozen ceiling "
                                  f"{LEGACY_CEILING[parsed.type]:03d}: mint a new one with `{helper}`"))

    if have_git:
        for gone in sorted(remote.base - tree, key=id_sort_key):
            findings.append((gone, "existed at the merge-base but is gone: IDs are immutable and "
                                   "never reused, so mark the row skipped or superseded instead"))
        added_here = tree - remote.base
        added_on_master = remote.master - remote.base
        for clash in sorted(added_here & added_on_master, key=id_sort_key):
            findings.append((clash, f"also added on {MASTER_REF} since this branch forked: "
                                    f"re-mint this branch's row with `scripts/backlog-new-id.py "
                                    f"{(parse_id(clash) or BacklogId(clash, '<TYPE>', 'new')).type}`"))
    elif require_remote:
        findings.append(("-", f"git history is required but unavailable: {remote.problem}"))
    else:
        warnings.append(f"collision check against {MASTER_REF} skipped: {remote.problem}")

    return findings, warnings
