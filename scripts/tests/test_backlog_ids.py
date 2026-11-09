"""Tests for the backlog ID rules (`scripts/backlog_ids.py`, check 17, `backlog-new-id.py`).

Run from the repo root (nothing here reaches `pnpm test`, so the CI job `Backlog IDs`
is the only runner):

    uv run --python 3.11 --with pyyaml python -m unittest discover -s scripts/tests -t scripts -v
"""
from __future__ import annotations

import datetime as dt
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import unittest

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(SCRIPTS)
sys.path.insert(0, SCRIPTS)

import yaml  # noqa: E402

import backlog_ids as b  # noqa: E402

BOARD_REL = "_bmad-output/implementation-artifacts/backlog.yaml"
REAL_BOARD = os.path.join(ROOT, BOARD_REL)
NEW_ID_RE = re.compile(r"^(BUG|IDEA|CC|FIND)-\d{6}-[a-z0-9]{3}$")


def row(created="2026-11-08", **extra):
    return {"type": "finding", "status": "backlog", "created": created, **extra}


def msgs(findings):
    return [f"{r}: {m}" for r, m in findings]


class ParseIdTests(unittest.TestCase):
    def test_legacy_and_new_shapes(self):
        legacy = b.parse_id("FIND-127")
        self.assertEqual((legacy.kind, legacy.type, legacy.number), ("legacy", "FIND", 127))
        new = b.parse_id("IDEA-261108-k3x")
        self.assertEqual((new.kind, new.type, new.yymmdd, new.suffix), ("new", "IDEA", "261108", "k3x"))

    def test_rejects_everything_else(self):
        for bad in ["find-127", "FIND-12", "FIND-1234", "FIND-26118-k3x", "FIND-261108-K3X",
                    "FIND-261108-k3", "FIND-261108-k3xy", "TASK-001", "FIND-261108", "", None, 127,
                    "FIND-127\n", "FIND-261108-k3x\n", "FIND-\u0661\u0662\u0663",
                    "FIND-\uff11\uff12\uff17"]:
            self.assertIsNone(b.parse_id(bad), bad)

    def test_impossible_calendar_dates(self):
        self.assertEqual(b.yymmdd_to_date("261108"), dt.date(2026, 11, 8))
        for bad in ["261308", "260230", "261100", "26110"]:
            self.assertIsNone(b.yymmdd_to_date(bad), bad)


class SortTests(unittest.TestCase):
    def test_types_group_legacy_first_then_new_by_date_then_suffix(self):
        ids = ["FIND-261109-aaa", "BUG-099", "FIND-127", "FIND-261108-zzz", "BUG-261001-abc",
               "FIND-009", "FIND-261108-aaa"]
        self.assertEqual(sorted(ids, key=b.id_sort_key),
                         ["BUG-099", "BUG-261001-abc", "FIND-009", "FIND-127",
                          "FIND-261108-aaa", "FIND-261108-zzz", "FIND-261109-aaa"])

    def test_unparseable_sorts_last_and_never_raises(self):
        ordered = sorted(["junk", 7, "FIND-261108-aaa", "BUG-001"], key=b.id_sort_key)
        self.assertEqual(ordered, ["BUG-001", "FIND-261108-aaa", 7, "junk"])


class MintTests(unittest.TestCase):
    def test_format_and_date(self):
        got = b.mint_id("FIND", dt.date(2026, 11, 8), set())
        self.assertRegex(got, NEW_ID_RE)
        self.assertTrue(got.startswith("FIND-261108-"))

    def test_rerolls_on_collision(self):
        picks = iter("aaa" + "bbb")
        got = b.mint_id("BUG", dt.date(2026, 11, 8), {"BUG-261108-aaa"}, choose=lambda _a: next(picks))
        self.assertEqual(got, "BUG-261108-bbb")

    def test_gives_up_when_the_day_is_full(self):
        with self.assertRaises(RuntimeError):
            b.mint_id("CC", dt.date(2026, 11, 8), {"CC-261108-aaa"}, choose=lambda _a: "a")

    def test_unknown_type(self):
        with self.assertRaises(ValueError):
            b.mint_id("TASK", dt.date(2026, 11, 8), set())

    def test_a_year_that_cannot_round_trip_is_refused(self):
        for day in (dt.date(1999, 12, 31), dt.date(2100, 1, 1)):
            with self.assertRaises(ValueError, msg=str(day)):
                b.mint_id("FIND", day, set())
        for day in (dt.date(2000, 1, 1), dt.date(2099, 12, 31)):
            self.assertEqual(b.yymmdd_to_date(b.mint_id("FIND", day, set()).split("-")[1]), day)


class ItemIdsTests(unittest.TestCase):
    def test_only_a_mapping_with_an_items_mapping_has_ids(self):
        self.assertEqual(b.item_ids({"items": {"FIND-001": {}, 7: {}}}), frozenset({"FIND-001", "7"}))
        for bad in (None, [], ["a"], "x", {}, {"items": ["x", "y"]}, {"items": None}):
            self.assertEqual(b.item_ids(bad), frozenset(), repr(bad))


class DuplicateLoaderTests(unittest.TestCase):
    def test_top_level_duplicate_is_reported_and_data_still_loads(self):
        text = "items:\n  FIND-001: {a: 1}\n  FIND-002: {a: 2}\n  FIND-001: {a: 3}\n"
        data, dups = b.load_board_text(text)
        self.assertEqual(dups, [("FIND-001", 2, 4)])
        self.assertEqual(len(data["items"]), 2)  # the silent loss check 17 exists to expose

    def test_duplicate_inside_a_flow_mapping_row(self):
        text = "items:\n  FIND-001: {note: x,\n     note: y}\n"
        _data, dups = b.load_board_text(text)
        self.assertEqual([d[0] for d in dups], ["note"])

    def test_no_duplicates(self):
        _data, dups = b.load_board_text("items:\n  FIND-001: {a: 1}\n  FIND-002: {a: 1}\n")
        self.assertEqual(dups, [])

    def test_non_string_keys_load_like_stock_yaml(self):
        data, dups = b.load_board_text("2026-11-08: x\n42: y\n")
        self.assertEqual(dups, [])
        self.assertEqual(data, {dt.date(2026, 11, 8): "x", 42: "y"})

    def test_an_unhashable_key_fails_exactly_as_stock_yaml_does(self):
        with self.assertRaises(yaml.constructor.ConstructorError):
            b.load_board_text("? [1, 2]\n: y\n")


class CheckIdsWithoutGitTests(unittest.TestCase):
    """No merge-base: the format rules plus the per-type ceiling fallback."""

    def run_check(self, items, **kw):
        return b.check_ids(items, **kw)

    def test_valid_new_and_frozen_legacy_pass(self):
        findings, warnings = self.run_check({"FIND-261108-k3x": row(), "FIND-127": row(created="2026-09-01")})
        self.assertEqual(findings, [])
        self.assertEqual(len(warnings), 1)  # the collision check was skipped, and says so

    def test_malformed_ids_fail(self):
        for bad in ["FIND-26118-k3x", "find-261108-k3x", "TASK-001", "FIND-261108-K3X"]:
            findings, _ = self.run_check({bad: row()})
            self.assertTrue(any("malformed ID" in m for m in msgs(findings)), bad)

    def test_impossible_date_fails(self):
        findings, _ = self.run_check({"FIND-261308-k3x": row()})
        self.assertIn("not a real calendar date", msgs(findings)[0])

    def test_created_must_equal_the_id_date_whether_quoted_or_not(self):
        ok_date, _ = self.run_check({"FIND-261108-k3x": row(created=dt.date(2026, 11, 8))})
        ok_str, _ = self.run_check({"FIND-261108-k3x": row(created="2026-11-08")})
        bad, _ = self.run_check({"FIND-261108-k3x": row(created=dt.date(2026, 11, 7))})
        self.assertEqual((ok_date, ok_str), ([], []))
        self.assertIn("created is 2026-11-07", msgs(bad)[0])
        missing, _ = self.run_check({"FIND-261108-k3x": {"type": "finding"}})
        self.assertIn("created is None", msgs(missing)[0])

    def test_legacy_above_the_ceiling_fails_and_names_the_helper(self):
        top = f"FIND-{b.LEGACY_CEILING['FIND']:03d}"
        over = f"FIND-{b.LEGACY_CEILING['FIND'] + 1:03d}"
        findings, _ = self.run_check({top: row(), over: row()})
        self.assertEqual([r for r, _m in findings], [over])
        self.assertIn("backlog-new-id.py FIND", findings[0][1])

    def test_a_row_that_is_not_a_mapping_is_a_finding_not_a_crash(self):
        for bad_row in ("oops", ["a"], 7, None):
            findings, _ = self.run_check({"FIND-261108-k3x": bad_row, "FIND-001": bad_row})
            self.assertEqual(sorted(r for r, _m in findings), ["FIND-001", "FIND-261108-k3x"], repr(bad_row))
            self.assertIn("not a mapping", findings[0][1])

    def test_prefix_is_not_compared_with_type(self):
        findings, _ = self.run_check({"BUG-261108-k3x": row(type="idea")})
        self.assertEqual(findings, [])  # reclassification keeps the ID (spec §4)

    def test_duplicate_keys_fail_with_a_rename_recipe(self):
        findings, _ = self.run_check({"FIND-261108-k3x": row()}, duplicates=[("FIND-261108-k3x", 10, 20)])
        self.assertIn("lines 10 and 20", msgs(findings)[0])
        self.assertIn("backlog-new-id.py FIND", msgs(findings)[0])
        other, _ = self.run_check({}, duplicates=[("note", 3, 4)])
        self.assertEqual(other[0][0], "-")
        self.assertIn("remove the repeated key", other[0][1])

    def test_missing_remote_warns_locally_and_fails_when_required(self):
        _f, warnings = self.run_check({"FIND-261108-k3x": row()}, remote=b.RemoteIds(problem="no remote"))
        self.assertIn("no remote", warnings[0])
        findings, warnings = self.run_check({"FIND-261108-k3x": row()}, remote=b.RemoteIds(problem="no remote"),
                                            require_remote=True)
        self.assertEqual(warnings, [])
        self.assertIn("required but unavailable", msgs(findings)[0])


class CheckIdsWithGitTests(unittest.TestCase):
    """With merge-base and origin/master known (the sets are injected here)."""

    BASE = frozenset({"FIND-001", "FIND-002"})

    def run_check(self, tree_ids, master_extra=()):
        items = {k: row(created="2026-11-08") if b.parse_id(k).kind == "new" else row() for k in tree_ids}
        remote = b.RemoteIds(base=self.BASE, master=self.BASE | frozenset(master_extra))
        return b.check_ids(items, remote=remote)[0]

    def test_clean_when_nothing_changed(self):
        self.assertEqual(self.run_check(["FIND-001", "FIND-002", "FIND-261108-k3x"]), [])

    def test_legacy_key_absent_at_the_merge_base_fails_even_below_the_ceiling(self):
        findings = self.run_check(["FIND-001", "FIND-002", "FIND-074", "FIND-128"])
        self.assertEqual(sorted(r for r, _m in findings), ["FIND-074", "FIND-128"])

    def test_removed_id_fails(self):
        findings = self.run_check(["FIND-001"])
        self.assertEqual([r for r, _m in findings], ["FIND-002"])
        self.assertIn("never reused", findings[0][1])

    def test_branch_collision_is_head_minus_base_intersect_master_minus_base(self):
        findings = self.run_check(["FIND-001", "FIND-002", "FIND-261108-k3x", "FIND-261108-aaa"],
                                  master_extra=["FIND-261108-k3x", "FIND-261109-zzz"])
        self.assertEqual([r for r, _m in findings], ["FIND-261108-k3x"])
        self.assertIn("re-mint", findings[0][1])

    def test_merge_ref_checkout_has_an_empty_master_minus_base(self):
        # HEAD already contains master: base == master, so no branch collision can be seen
        # (duplicate-key detection is the gate there).
        items = {"FIND-001": row(), "FIND-261108-k3x": row()}
        remote = b.RemoteIds(base=frozenset({"FIND-001", "FIND-261108-k3x"}),
                             master=frozenset({"FIND-001", "FIND-261108-k3x"}))
        self.assertEqual(b.check_ids(items, remote=remote)[0], [])


def clean_env():
    """The environment without CI and without any GIT_* variable (a hook exports GIT_DIR and friends,
    which would point the temporary repositories below at the real one)."""
    return {k: v for k, v in os.environ.items() if k != "CI" and not k.startswith("GIT_")}


def git(repo, *args):
    subprocess.run(["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com",
                    "-c", "commit.gpgsign=false", *args], check=True, capture_output=True, text=True,
                   env=clean_env())


def board_text(*ids):
    rows = "".join(f"  {i}: {{type: finding, status: backlog, created: 2026-11-08}}\n" for i in ids)
    return f"tags: {{web: [events]}}\nitems:\n{rows}"


class RemoteIdsGitTests(unittest.TestCase):
    """A real temporary repository, so merge-base and ref lookups are exercised for real."""

    def write(self, repo, *ids):
        path = os.path.join(repo, BOARD_REL)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(board_text(*ids))

    def make_repo(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        repo = tmp.name
        git(repo, "init", "-q", "-b", "master")
        self.write(repo, "FIND-001")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "base")
        return repo

    def test_collision_found_through_real_merge_base(self):
        repo = self.make_repo()
        git(repo, "checkout", "-q", "-b", "work")
        git(repo, "checkout", "-q", "master")
        self.write(repo, "FIND-001", "FIND-261108-aaa")
        git(repo, "commit", "-q", "-am", "master adds a row")
        git(repo, "update-ref", "refs/remotes/origin/master", "HEAD")
        git(repo, "checkout", "-q", "work")
        self.write(repo, "FIND-001", "FIND-261108-aaa")
        remote = b.load_remote_ids(repo, BOARD_REL)
        self.assertEqual(remote.problem, "")
        self.assertEqual(remote.base, frozenset({"FIND-001"}))
        self.assertEqual(remote.master, frozenset({"FIND-001", "FIND-261108-aaa"}))
        data, dups = b.load_board_text(board_text("FIND-001", "FIND-261108-aaa"))
        findings, _ = b.check_ids(data["items"], dups, remote)
        self.assertEqual([r for r, _m in findings], ["FIND-261108-aaa"])
        self.assertEqual(b.taken_ids(b.item_ids(data), remote),
                         frozenset({"FIND-001", "FIND-261108-aaa"}))

    def test_missing_origin_master_is_a_problem_not_a_crash(self):
        repo = self.make_repo()
        remote = b.load_remote_ids(repo, BOARD_REL)
        self.assertIn("origin/master is not available", remote.problem)
        self.assertIsNone(remote.base)

    def test_a_board_that_is_not_a_board_at_a_ref_is_a_problem_not_a_crash_or_an_empty_set(self):
        repo = self.make_repo()
        with open(os.path.join(repo, BOARD_REL), "w", encoding="utf-8") as fh:
            fh.write("- not\n- a board\n")
        git(repo, "commit", "-q", "-am", "list at top level")
        git(repo, "update-ref", "refs/remotes/origin/master", "HEAD")
        remote = b.load_remote_ids(repo, BOARD_REL)
        self.assertIsNone(remote.master)
        self.assertIn("could not read", remote.problem)

    def test_board_absent_at_the_ref_reads_as_empty(self):
        repo = self.make_repo()
        git(repo, "rm", "-q", BOARD_REL)
        git(repo, "commit", "-q", "-m", "drop board")
        git(repo, "update-ref", "refs/remotes/origin/master", "HEAD")
        self.assertEqual(b.load_remote_ids(repo, BOARD_REL).master, frozenset())


class RealBoardTests(unittest.TestCase):
    def test_board_has_no_duplicate_keys_and_every_id_parses(self):
        with open(REAL_BOARD, encoding="utf-8") as fh:
            data, dups = b.load_board_text(fh.read())
        self.assertEqual(dups, [])
        self.assertEqual([k for k in data["items"] if b.parse_id(k) is None], [])

    def test_legacy_ceilings_equal_the_boards_real_maximums(self):
        with open(REAL_BOARD, encoding="utf-8") as fh:
            data, _ = b.load_board_text(fh.read())
        top: dict = {}
        for key in data["items"]:
            parsed = b.parse_id(key)
            if parsed.kind == "legacy":
                top[parsed.type] = max(top.get(parsed.type, 0), parsed.number)
        self.assertEqual(top, b.LEGACY_CEILING)


class CliTests(unittest.TestCase):
    def run_script(self, name, *args):
        return subprocess.run([sys.executable, os.path.join(SCRIPTS, name), *args],
                              capture_output=True, text=True, env=clean_env())

    def test_new_id_prints_only_the_id(self):
        done = self.run_script("backlog-new-id.py", "find", "--date", "2026-11-08")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertRegex(done.stdout.strip(), r"^FIND-261108-[a-z0-9]{3}$")
        self.assertEqual(len(done.stdout.strip().splitlines()), 1)
        self.assertIn("created: 2026-11-08", done.stderr)

    def test_new_id_rejects_bad_type_and_date(self):
        self.assertEqual(self.run_script("backlog-new-id.py", "TASK").returncode, 2)
        self.assertEqual(self.run_script("backlog-new-id.py", "BUG", "--date", "11/08/2026").returncode, 2)

    def synthetic_board(self, ids):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = os.path.join(tmp.name, "backlog.yaml")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(board_text(*ids))
        return tmp.name, path

    def test_new_id_refuses_dates_that_cannot_be_an_id(self):
        future = (dt.datetime.now(dt.timezone.utc).date() + dt.timedelta(days=30)).isoformat()
        for bad in ("1999-12-31", "2100-01-01", future):
            done = self.run_script("backlog-new-id.py", "FIND", "--date", bad)
            self.assertEqual(done.returncode, 2, bad)
            self.assertEqual(done.stdout, "")

    def test_new_id_reports_an_unreadable_board_instead_of_a_traceback(self):
        repo, board = self.synthetic_board(["FIND-001"])
        done = self.run_script("backlog-new-id.py", "FIND", "--board", os.path.join(repo, "missing.yaml"),
                               "--repo", repo)
        self.assertEqual(done.returncode, 2)
        self.assertIn("cannot read the board", done.stderr)
        self.assertNotIn("Traceback", done.stderr)
        with open(board, "w", encoding="utf-8") as fh:
            fh.write("items: [unclosed\n")
        done = self.run_script("backlog-new-id.py", "FIND", "--board", board, "--repo", repo)
        self.assertEqual(done.returncode, 2)
        self.assertNotIn("Traceback", done.stderr)

    def test_only_rejects_unknown_or_empty_check_numbers(self):
        repo, board = self.synthetic_board(["FIND-261108-k3x"])
        for bad in ("71", "99", "0", "", "15,99", "x"):
            done = self.run_script("backlog-check.py", "--only", bad, "--board", board, "--repo", repo)
            self.assertEqual(done.returncode, 2, repr(bad))
            self.assertIn("--only", done.stderr)
            self.assertNotIn("clean", done.stdout)

    def test_the_exit_status_never_wraps_to_zero(self):
        repo, board = self.synthetic_board([f"bogus-{n}" for n in range(256)])
        done = self.run_script("backlog-check.py", "--only", "17", "--board", board, "--repo", repo)
        self.assertEqual(done.returncode, 255, "256 failures must not read as exit 0")
        self.assertEqual(done.stdout.count("malformed ID"), 256)

    def test_only_17_does_not_need_checks_1_to_16_or_the_sprint_file(self):
        repo, board = self.synthetic_board(["FIND-261108-k3x"])
        with open(board, "a", encoding="utf-8") as fh:
            fh.write("  FIND-261108-zzz: {type: finding, status: backlog, created: 2026-11-08, touches: 7}\n")
        done = self.run_script("backlog-check.py", "--only", "17", "--board", board, "--repo", repo)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)  # a bad `touches` is check 3's business
        self.assertNotIn("Traceback", done.stderr)
        self.assertIn("ID collision rules NOT run", done.stdout)

    def test_only_17_counts_just_check_17(self):
        repo, board = self.synthetic_board(["FIND-261108-k3x", "bogus-1"])
        done = self.run_script("backlog-check.py", "--only", "17", "--board", board, "--repo", repo)
        self.assertEqual(done.returncode, 1, done.stdout + done.stderr)  # only the malformed ID counts
        self.assertIn("malformed ID", done.stdout)
        self.assertIn("warning: collision check", done.stderr)  # a non-repo: warn, not fail

    def test_require_remote_turns_the_warning_into_a_failure(self):
        repo, board = self.synthetic_board(["FIND-261108-k3x"])
        done = self.run_script("backlog-check.py", "--only", "17", "--require-remote",
                               "--board", board, "--repo", repo)
        self.assertEqual(done.returncode, 1, done.stdout)
        self.assertIn("required but unavailable", done.stdout)

    def test_ci_env_implies_require_remote(self):
        repo, board = self.synthetic_board(["FIND-261108-k3x"])
        env = {**clean_env(), "CI": "true"}
        done = subprocess.run([sys.executable, os.path.join(SCRIPTS, "backlog-check.py"), "--only", "17",
                               "--board", board, "--repo", repo], capture_output=True, text=True, env=env)
        self.assertEqual(done.returncode, 1, done.stdout)


if __name__ == "__main__":
    unittest.main()
