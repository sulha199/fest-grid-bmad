"""Tests for dedup_report.py. Standard library only.

Run: python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py

The logs here are built in the shape of a real get_job_logs answer: a JSON wrapper, a 7-digit
timestamp on every line, and the export workflow's summary step echoing its own `awk` script (which
contains both marker strings). Set DEDUP_REPORT_REAL_LOG to a saved real export log (run tag
`dryrun-pick` unless DEDUP_REPORT_REAL_TAG says otherwise) to run the extra test that reads it.
"""
import contextlib
import copy
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = importlib.util.spec_from_file_location('dedup_report', os.path.join(HERE, 'dedup_report.py'))
dr = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dr)

A, B, C = ('00000000-0000-4000-8000-00000000000%d' % i for i in (1, 2, 3))
HASH = 'ab' * 32
MERGE = '11111111-1111-4111-8111-111111111111'
TAG = 't1'


def event(name='Example Run 10K', **over):
    base = {
        'name': name, 'slug': 'ig_p_Example1', 'location': 'Example Hall', 'links': ['example.org/run'],
        'detailLevel': 'full', 'categories': ['SPORTS_AND_FITNESS'], 'types': ['RACE'],
        'schedules': [{'isMain': True, 'startDate': '2026-11-20', 'endDate': None, 'startTime': '06:00:00',
                       'endTime': None, 'timezone': None, 'title': 'Race day', 'location': 'Example Hall'}],
        'sourcePosts': [{'isPrimary': True, 'accountType': 'ORGANIZER_VENUE_EVENT', 'publishedAt': '2026-11-01T03:00:00.000Z'}],
    }
    base.update(over)
    return base


def pair(suggestion_id=A, tier='mid', candidate=None, new=None, undone=0):
    return {
        'suggestionId': suggestion_id, 'status': 'pending', 'storedScore': 0.5,
        'signals': {'tier': tier, 'scoredTier': tier, 'score': 0.5, 'promotedByRule': False, 'promotionRule': None,
                    'stubRepeat': False, 'venueMatch': True, 'nameSimilarity': 0.6, 'minDayDiff': 0,
                    'organizerMatch': True, 'sharedLink': False},
        'sameAccount': True, 'undoneMergeCount': undone,
        'candidate': candidate or event(), 'newEvent': new or event('Example Run 10 K'), 'evidenceHash': HASH,
    }


def export_payload(pairs=None, resolved=None, run_tag=TAG):
    return {
        'schemaVersion': 1, 'generatedAt': '2026-11-03T02:59:06.586Z', 'runTag': run_tag, 'limit': 10,
        'totalPending': 160, 'staleCount': 0, 'skippedCount': 1, 'scanLimited': False,
        'pairs': [pair()] if pairs is None else pairs,
        'recentlyResolved': resolved or [], 'recentlyResolvedTruncated': False,
    }


def apply_payload(mode='validate', results=None, run_tag=TAG, counts=None):
    results = results if results is not None else [{'suggestionId': A, 'outcome': 'eligible'}]
    tally = {k: sum(1 for r in results if r['outcome'] == k) for k in ('eligible', 'merged', 'skipped')}
    return {'schemaVersion': 1, 'generatedAt': '2026-11-03T03:00:56.321Z', 'runTag': run_tag, 'mode': mode,
            'killSwitch': False, 'usedLast24h': 0, 'caps': {'perRun': 10, 'perDay': 25}, 'counts': counts or tally,
            'results': results}


def make_log(begin, end, payload_line, wrap=True, eol='\n', extra_after=(), echo=True):
    lines = ['Set up job', 'Current runner version']
    if echo:
        lines.append("json=$(awk '/^%s$/ {inside=1; next} /^%s$/ {inside=0} inside' \"$RUNNER_TEMP/out\")" % (begin, end))
    lines += [begin] if begin else []
    lines += [payload_line] if payload_line is not None else []
    lines += [end] if end else []
    lines += list(extra_after)
    stamped = ['2026-11-03T02:59:%02d.8113469Z %s' % (i % 60, line) for i, line in enumerate(lines)]
    text = eol.join(stamped)
    if not wrap:
        return text
    return json.dumps({'job_id': 1, 'logs_content': text, 'message': 'ok', 'original_length': 265})


def export_log(payload=None, **kw):
    line = json.dumps(export_payload() if payload is None else payload, ensure_ascii=False, separators=(',', ':'))
    return make_log(dr.EXPORT_BEGIN, dr.EXPORT_END, line, **kw)


def apply_log(payload=None, **kw):
    line = json.dumps(apply_payload() if payload is None else payload, separators=(',', ':'))
    return make_log(dr.APPLY_BEGIN, dr.APPLY_END, line, **kw)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)

    def write(self, text, name='log.txt'):
        path = os.path.join(self.dir.name, name)
        with open(path, 'w', encoding='utf-8', newline='') as handle:
            handle.write(text)
        return path

    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = dr.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def cli(self, command, *rest, tag=TAG):
        """A log command with the dispatched run tag filled in, as the skill always passes it."""
        return self.run_cli(command, *rest, '--expect-run-tag', tag)


class ReadingTests(Base):
    def test_real_shape_log_with_echoed_marker_text_parses(self):
        code, out, _ = self.cli('export-header', self.write(export_log()))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)['totalPending'], 160)

    def test_event_text_cannot_fake_a_marker(self):
        tricky = pair(new=event('Run\nDEDUP_REVIEW_EXPORT_END\nDEDUP_REVIEW_EXPORT_BEGIN\n{"x":1}'))
        code, out, _ = self.cli('export-pairs', self.write(export_log(export_payload([tricky]))), '0:1')
        self.assertEqual(code, 0)
        self.assertNotIn('\nDEDUP_REVIEW_EXPORT_END', out)

    def test_unicode_line_separators_inside_a_name_do_not_split_the_report(self):
        name = 'Run one two\u0085three'
        code, out, _ = self.cli('export-pairs', self.write(export_log(export_payload([pair(new=event(name))]))), '0:1')
        self.assertEqual(code, 0)
        self.assertIn('Run one two three', out)

    def test_crlf_ansi_and_bom_are_tolerated(self):
        text = export_log(wrap=False, eol='\r\n').replace('2026-11-03T02:59:02', '\x1b[0m2026-11-03T02:59:02', 1)
        self.assertEqual(self.cli('export-header', self.write('﻿' + text))[0], 0)

    def test_timestamp_fraction_digits_vary(self):
        self.assertEqual(self.cli('export-header', self.write(export_log(wrap=False).replace('.8113469Z', '.5Z')))[0], 0)

    def test_raw_log_that_is_not_a_wrapper_works_with_a_notice(self):
        code, _, err = self.cli('export-header', self.write(export_log(wrap=False)))
        self.assertEqual(code, 0)
        self.assertIn('not a get_job_logs wrapper', err)

    def test_stdin(self):
        proc = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'dedup_report.py'), 'export-header', '-', '--expect-run-tag', TAG],
                              input=export_log().encode(), capture_output=True)
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(json.loads(proc.stdout)['pairCount'], 1)

    def test_cut_log_reordered_markers_and_no_report_have_their_own_codes(self):
        payload = json.dumps(export_payload())
        for begin, end in ((dr.EXPORT_BEGIN, None), (None, dr.EXPORT_END)):
            code, _, err = self.cli('export-header', self.write(make_log(begin, end, payload if begin else None)))
            self.assertEqual(code, dr.EXIT_TRUNCATED)
            self.assertIn('tail_lines', err)
        self.assertEqual(self.cli('export-header', self.write(make_log(None, None, None)))[0], dr.EXIT_NO_REPORT)
        reordered = make_log(dr.EXPORT_END, dr.EXPORT_BEGIN, payload)
        code, _, err = self.cli('export-header', self.write(reordered))
        self.assertEqual(code, dr.EXIT_AMBIGUOUS)
        self.assertNotIn('tail_lines', err)  # refetching cannot fix this

    def test_two_pairs_and_a_multiline_report_are_ambiguous(self):
        once = export_log(wrap=False)
        self.assertEqual(self.cli('export-header', self.write(json.dumps({'logs_content': once + '\n' + once})))[0], dr.EXIT_AMBIGUOUS)
        broken = make_log(dr.EXPORT_BEGIN, dr.EXPORT_END, '{"schemaVersion":1,')
        broken = broken.replace('{\\"schemaVersion\\":1,', '{\\"schemaVersion\\":1,\\n2026-11-03T02:59:09.0000000Z extra')
        self.assertEqual(self.cli('export-header', self.write(broken))[0], dr.EXIT_AMBIGUOUS)

    def test_refusal_is_reported_without_the_environment_echo(self):
        log = make_log(None, None, None, extra_after=[
            'DEDUP_REVIEW_INVOKER_HASH: ' + HASH, 'DECISIONS: {"schemaVersion":1}',
            'Apply refused: No single active moderator matches the invoker.', '##[error]Process completed with exit code 1.'], echo=False)
        code, _, err = self.run_cli('apply', self.write(log), '--expect-run-tag', TAG, '--expect-mode', 'validate', '--expect-ids', A)
        self.assertEqual(code, dr.EXIT_REFUSED)
        self.assertIn('Apply refused: No single active moderator', err)
        self.assertNotIn(HASH, err)
        self.assertNotIn('DECISIONS', err)

    def test_a_log_from_another_run_is_refused_by_every_command(self):
        path = self.write(export_log())  # carries run tag t1
        for command in (('export-header', path), ('export-pairs', path, '0:1'), ('export-resolved', path),
                        ('decisions', path, A), ('issue', path, '--id', A, '--pattern', 'other', '--reason', 'unsure', '--rationale-file', self.write('x', 'r.txt'))):
            self.assertEqual(self.cli(*command, tag='previous-run')[0], dr.EXIT_BAD_REPORT, command)

    def test_the_run_tag_flag_is_required(self):
        path = self.write(export_log())
        self.assertEqual(self.run_cli('export-header', path)[0], dr.EXIT_USAGE)
        self.assertEqual(self.run_cli('decisions', path, A)[0], dr.EXIT_USAGE)

    def test_version_payload_and_file_problems(self):
        self.assertEqual(self.cli('export-header', self.write(export_log(dict(export_payload(), schemaVersion=2))))[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.cli('export-header', self.write(make_log(dr.EXPORT_BEGIN, dr.EXPORT_END, 'not json')))[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.cli('export-header', os.path.join(self.dir.name, 'nope'))[0], dr.EXIT_IO)

    def test_malformed_shapes_exit_7_and_never_a_traceback(self):
        def broken(mutate):
            payload = export_payload([pair()])
            mutate(payload)
            return self.cli('export-header', self.write(export_log(payload)))

        cases = {
            'links null': lambda p: p['pairs'][0]['newEvent'].update(links=None),
            'sourcePosts null': lambda p: p['pairs'][0]['candidate'].update(sourcePosts=None),
            'schedules not dicts': lambda p: p['pairs'][0]['newEvent'].update(schedules=['x']),
            'schedule without date': lambda p: p['pairs'][0]['newEvent']['schedules'][0].pop('startDate'),
            'name number': lambda p: p['pairs'][0]['newEvent'].update(name=7),
            'signals string': lambda p: p['pairs'][0].update(signals='mid'),
            'score text': lambda p: p['pairs'][0]['signals'].update(score='![x](http://evil)'),
            'tier unknown': lambda p: p['pairs'][0]['signals'].update(tier='extreme'),
            'generatedAt markup': lambda p: p.update(generatedAt='@victim'),
            'runTag missing': lambda p: p.pop('runTag'),
            'bad account type': lambda p: p['pairs'][0]['newEvent']['sourcePosts'][0].update(accountType='ADMIN'),
            'negative skippedCount': lambda p: p.update(skippedCount=-1),
        }
        for label, mutate in cases.items():
            code, _, err = broken(mutate)
            self.assertEqual(code, dr.EXIT_BAD_REPORT, label)
            self.assertNotIn('Traceback', err, label)

    def test_deeply_nested_json_does_not_crash(self):
        nested = '[' * 100000 + ']' * 100000
        code, _, err = self.cli('export-header', self.write(make_log(dr.EXPORT_BEGIN, dr.EXPORT_END, nested)))
        self.assertEqual(code, dr.EXIT_BAD_REPORT)
        self.assertNotIn('Traceback', err)

    @unittest.skipUnless(os.environ.get('DEDUP_REPORT_REAL_LOG'), 'set DEDUP_REPORT_REAL_LOG to a saved real export log')
    def test_a_real_saved_log(self):
        tag = os.environ.get('DEDUP_REPORT_REAL_TAG', 'dryrun-pick')
        code, out, _ = self.cli('export-header', os.environ['DEDUP_REPORT_REAL_LOG'], tag=tag)
        self.assertEqual(code, 0)
        pairs = json.loads(out)['pairCount']
        self.assertGreater(pairs, 0)
        self.assertEqual(self.cli('export-pairs', os.environ['DEDUP_REPORT_REAL_LOG'], '0:%d' % pairs, tag=tag)[0], 0)


class ExportCommandTests(Base):
    def test_resolved_default_hides_expired_and_ids_shows_everything(self):
        rows = [{'suggestionId': A, 'status': 'expired', 'resolvedBy': 'system', 'resolvedAt': '2026-11-01T00:00:00.000Z'},
                {'suggestionId': B, 'status': 'accepted', 'resolvedBy': 'human', 'resolvedAt': '2026-11-02T00:00:00.000Z'}]
        path = self.write(export_log(export_payload(resolved=rows)))
        _, out, _ = self.cli('export-resolved', path)
        self.assertIn(B, out)
        self.assertNotIn(A, out)
        _, out, _ = self.cli('export-resolved', path, '--ids', A.upper())
        self.assertIn(A, out)
        for bad in ('nope', '', A + ',nope', A + 'x'):
            self.assertEqual(self.cli('export-resolved', path, '--ids', bad)[0], dr.EXIT_BAD_INPUT, repr(bad))
        code, out, _ = self.cli('export-resolved', path, '--ids', ' %s \n' % A)  # whitespace around an id is trimmed, then validated
        self.assertEqual(code, 0)
        self.assertNotIn('\\n', out.splitlines()[0])

    def test_decisions_carry_the_exact_hash_and_no_reasons(self):
        path = self.write(export_log(export_payload([pair(A), pair(B)])))
        code, out, _ = self.cli('decisions', path, A.upper(), B)
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)['decisions'][0], {'suggestionId': A, 'evidenceHash': HASH, 'reasons': []})
        self.assertNotIn(' ', out)
        self.assertEqual(self.cli('decisions', path, C)[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.cli('decisions', path, A, A)[0], dr.EXIT_BAD_INPUT)

    def test_pairs_cleaning_and_range(self):
        nasty = pair(new=event('Evil‮​Name' + 'x' * 500))
        path = self.write(export_log(export_payload([nasty])))
        _, out, _ = self.cli('export-pairs', path, '0:5')
        self.assertNotIn('‮', out)
        self.assertNotIn('​', out)
        self.assertLess(len(out), 6000)
        self.assertEqual(self.cli('export-pairs', path, '3:1')[0], dr.EXIT_USAGE)
        code, _, err = self.cli('export-pairs', path, '5:10')
        self.assertEqual(code, 0)
        self.assertIn('past the end', err)

    def test_a_cut_list_is_marked_and_counted(self):
        many = [dict(event()['schedules'][0], startDate='2026-11-%02d' % (i + 1)) for i in range(20)]
        path = self.write(export_log(export_payload([pair(new=event(schedules=many))])))
        _, out, _ = self.cli('export-pairs', path, '0:1')
        row = json.loads(out.splitlines()[-1])
        self.assertEqual(row['truncated'], 8)
        self.assertIn('(+8 more)', json.dumps(row))

    def test_header_age_and_unknown_count(self):
        path = self.write(export_log())
        _, out, _ = self.cli('export-header', path, '--sent', '5', '--closed', '2')
        header = json.loads(out)
        self.assertAlmostEqual(header['firstPairNewestPostAgeDays'], 2.0, delta=0.2)
        self.assertEqual(header['unknownCount'], 2)  # 5 sent - 1 still pending - 2 closed
        self.assertEqual(json.loads(self.cli('export-header', path, '--sent', '1', '--closed', '5')[1])['unknownCount'], 0)
        self.assertEqual(self.cli('export-header', path, '--sent', '1')[0], dr.EXIT_BAD_INPUT)


class ApplyTests(Base):
    def apply(self, log_text, mode='validate', ids=A, tag=TAG):
        return self.run_cli('apply', self.write(log_text), '--expect-run-tag', tag, '--expect-mode', mode, '--expect-ids', ids)

    def test_validate_report(self):
        code, out, _ = self.apply(apply_log())
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)['counts']['eligible'], 1)

    def test_mode_tag_ids_and_consistency_are_checked(self):
        self.assertEqual(self.apply(apply_log(), mode='live')[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.apply(apply_log(), tag='x')[0], dr.EXIT_BAD_REPORT)
        wrong_counts = apply_payload(counts={'eligible': 5, 'merged': 0, 'skipped': 0})
        self.assertEqual(self.apply(apply_log(wrong_counts))[0], dr.EXIT_BAD_REPORT)
        merged_in_validate = apply_payload(results=[{'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE}])
        self.assertEqual(self.apply(apply_log(merged_in_validate))[0], dr.EXIT_BAD_REPORT)
        no_reason = apply_payload(results=[{'suggestionId': A, 'outcome': 'skipped'}])
        self.assertEqual(self.apply(apply_log(no_reason))[0], dr.EXIT_BAD_REPORT)
        unknown_reason = apply_payload(results=[{'suggestionId': A, 'outcome': 'skipped', 'reason': 'made-up'}])
        self.assertEqual(self.apply(apply_log(unknown_reason))[0], dr.EXIT_BAD_REPORT)

    def test_results_must_be_exactly_the_dispatched_suggestions(self):
        both = '%s,%s' % (A, B)
        self.assertEqual(self.apply(apply_log(), ids=both)[0], dr.EXIT_BAD_REPORT)  # a dropped decision goes unnoticed otherwise
        twice = apply_payload(results=[{'suggestionId': A, 'outcome': 'eligible'}, {'suggestionId': A, 'outcome': 'eligible'}])
        self.assertEqual(self.apply(apply_log(twice))[0], dr.EXIT_BAD_REPORT)
        empty = apply_payload(results=[])
        self.assertEqual(self.apply(apply_log(empty))[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.apply(apply_log(), ids='nope')[0], dr.EXIT_BAD_INPUT)

    def test_live_report(self):
        good = apply_payload('live', [{'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE},
                                      {'suggestionId': B, 'outcome': 'skipped', 'reason': 'concurrent-change'}])
        self.assertEqual(self.apply(apply_log(good), mode='live', ids='%s,%s' % (A, B))[0], 0)
        no_id = apply_payload('live', [{'suggestionId': A, 'outcome': 'merged'}])
        self.assertEqual(self.apply(apply_log(no_id), mode='live')[0], dr.EXIT_BAD_REPORT)
        eligible_in_live = apply_payload('live', [{'suggestionId': A, 'outcome': 'eligible'}])
        self.assertEqual(self.apply(apply_log(eligible_in_live), mode='live')[0], dr.EXIT_BAD_REPORT)

    def test_kill_switch_report_is_a_refusal(self):
        disabled = dict(apply_payload(results=[]), mode='disabled', runTag=None)
        self.assertEqual(self.apply(apply_log(disabled))[0], dr.EXIT_REFUSED)


class IssueListTests(Base):
    def listing(self, extra=()):
        def issue(number, title, labels, state='OPEN', created='2026-11-0%dT00:00:00Z'):
            return {'number': number, 'title': title, 'state': state, 'labels': labels, 'created_at': created % number}
        return {'issues': [
            issue(1, 'Dedup review: ' + A, ['dedup-escalate', 'pattern:other']),
            issue(2, 'Dedup review: ' + B + ' (shadow)', [{'name': 'dedup-escalate'}]),
            issue(3, 'Dedup review: ' + C, ['bug']),                             # a look-alike without the label
            issue(4, 'Dedup review: ' + C + ' (urgent)', ['dedup-escalate']),    # label, but not the exact title
            issue(5, 'Dedup review: ' + A, ['dedup-escalate'], state='CLOSED'),  # a twin of issue 1
            issue(6, 'Dedup review: ABCDEF01-0000-4000-8000-000000000000', ['dedup-escalate']),  # upper-case hex
            issue(7, 'Dedup review: ' + A + '\n', ['dedup-escalate']),           # trailing newline
            *extra,
        ], 'pageInfo': {}}

    def ids(self, *extra_args, data=None):
        path = self.write(json.dumps(self.listing() if data is None else data), 'issues.json')
        return self.run_cli('issue-ids', path, '--max', '200', *extra_args)

    def test_only_labelled_exact_titles_count_and_the_rest_is_listed(self):
        code, out, _ = self.ids()
        result = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(result['ids'], [A, B])
        self.assertEqual(result['ignored'], 1)            # issue 3: no label
        self.assertEqual(result['labelledIgnored'], [4, 6, 7])  # labelled but not an exact title: shown, not hidden
        self.assertEqual(result['duplicates'], {A: [1, 5]})  # the twin is not hidden
        self.assertEqual(result['oldestOpenCreatedAt'], '2026-11-01T00:00:00Z')
        self.assertEqual(result['shadowOpen'], [B])
        self.assertEqual(result['closed'], [A])

    def test_exclude_shadow_and_cap(self):
        result = json.loads(self.ids('--exclude-shadow')[1])
        self.assertEqual(result['ids'], [A])
        path = self.write(json.dumps(self.listing()), 'i.json')
        capped = json.loads(self.run_cli('issue-ids', path, '--max', '1')[1])
        self.assertEqual(capped['ids'], [A])
        self.assertTrue(capped['capped'])
        for bad in ('0', '-1'):
            self.assertEqual(self.run_cli('issue-ids', path, '--max', bad)[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('issue-ids', path)[0], dr.EXIT_USAGE)  # --max is required

    def test_pages_merge_and_content_blocks_are_unwrapped(self):
        page2 = {'issues': [{'number': 9, 'title': 'Dedup review: ' + C, 'state': 'OPEN', 'labels': ['dedup-escalate'], 'created_at': '2026-11-09T00:00:00Z'}]}
        first = self.write(json.dumps(self.listing()), 'p1.json')
        second = self.write(json.dumps([{'type': 'text', 'text': json.dumps(page2)}]), 'p2.json')
        result = json.loads(self.run_cli('issue-ids', first, second, '--max', '200')[1])
        self.assertEqual(result['ids'], [A, B, C])

    def test_unrecognised_shapes_fail_loudly(self):
        for label, data in (('no list', {'a': 1}), ('labels as a string', {'issues': [{'title': 't', 'labels': 'dedup-escalate'}]}),
                            ('label without name', {'issues': [{'title': 't', 'labels': [{'id': 1}]}]}), ('entry not an object', {'issues': ['x']})):
            self.assertEqual(self.ids(data=data)[0], dr.EXIT_BAD_INPUT, label)
        self.assertEqual(self.run_cli('issue-ids', self.write('nope', 'x.json'), '--max', '5')[0], dr.EXIT_BAD_INPUT)
        odd = {'issues': [{'number': 'x', 'title': 5, 'state': 'OPEN', 'labels': ['dedup-escalate']}]}
        code, out, _ = self.ids(data=odd)
        self.assertEqual((code, json.loads(out)['labelledIgnored']), (0, [None]))  # a non-string title, no traceback

    def test_triage_separates_new_known_and_closed_pending_pairs(self):
        issues = {'issues': [
            {'number': 1, 'title': 'Dedup review: ' + A, 'state': 'OPEN', 'labels': ['dedup-escalate'], 'created_at': '2026-11-01T00:00:00Z'},
            {'number': 2, 'title': 'Dedup review: ' + B + ' (shadow)', 'state': 'OPEN', 'labels': ['dedup-escalate'], 'created_at': '2026-11-02T00:00:00Z'},
            {'number': 3, 'title': 'Dedup review: ' + C, 'state': 'CLOSED', 'labels': ['dedup-escalate'], 'created_at': '2026-11-03T00:00:00Z'},
        ]}
        ipath = self.write(json.dumps(issues), 'iss.json')
        log = self.write(export_log(export_payload([pair(A), pair(B), pair(C, undone=1), pair('00000000-0000-4000-8000-000000000004')])))
        shadow_only = json.loads(self.cli('triage', log, ipath)[1])
        self.assertEqual(shadow_only['new'], ['00000000-0000-4000-8000-000000000004'])
        self.assertEqual([k['id'] for k in shadow_only['known']], [A, B])
        self.assertEqual(shadow_only['closedPending'], [{'id': C, 'number': 3, 'undoneMergeCount': 1}])
        self.assertFalse(shadow_only['blocked'])
        cleared = json.loads(self.cli('triage', log, ipath, '--live-cleared')[1])
        self.assertEqual(cleared['reconsider'], [{'id': B, 'number': 2}])  # the shadow pair comes back for a fresh decision
        self.assertEqual([k['id'] for k in cleared['known']], [A])

    def test_triage_reports_a_blocked_head_of_the_queue(self):
        issues = {'issues': [{'number': 1, 'title': 'Dedup review: ' + A, 'state': 'CLOSED', 'labels': ['dedup-escalate'], 'created_at': '2026-11-01T00:00:00Z'}]}
        result = json.loads(self.cli('triage', self.write(export_log()), self.write(json.dumps(issues), 'i.json'))[1])
        self.assertTrue(result['blocked'])
        empty = json.loads(self.cli('triage', self.write(export_log(export_payload([]))), self.write('{"issues":[]}', 'e.json'))[1])
        self.assertFalse(empty['blocked'])  # nothing exported is not "blocked"


class TextBuilderTests(Base):
    def rationale(self, text='same race, spelled differently', name='rationale.txt'):
        return self.write(text, name)

    def issue(self, path, *extra, pattern='name-language', rationale=None):
        return self.cli('issue', path, '--id', A, '--pattern', pattern, '--rationale-file', rationale or self.rationale(), *extra)

    def fences(self, body):
        return re.findall(r'^(`{3,})$', body, re.M)

    def test_escalation_issue_has_id_title_labels_and_long_enough_fences(self):
        hostile = pair(new=event('Run ```` ending ``` @someone #12 <script>'), candidate=event('x ``` y'))
        path = self.write(export_log(export_payload([hostile])))
        code, out, _ = self.issue(path, '--reason', 'name-mismatch', '--json')
        self.assertEqual(code, 0)
        issue = json.loads(out)
        self.assertEqual(issue['title'], 'Dedup review: ' + A)
        self.assertEqual(issue['labels'], ['dedup-escalate', 'pattern:name-language'])
        fences = self.fences(issue['body'])
        self.assertEqual(len(fences), 6)
        self.assertIn(5, {len(f) for f in fences})  # one longer than the run of four in the new event's name
        self.assertTrue(all(len(fences[i]) == len(fences[i + 1]) for i in (0, 2, 4)))
        outside = re.sub(r'(`{3,})\n.*?\n\1', '', issue['body'], flags=re.S)
        self.assertNotIn('someone', outside)
        self.assertIn('escalated: name-mismatch', issue['body'])

    def test_shadow_issue_title_marks_it(self):
        code, out, _ = self.issue(self.write(export_log()), '--shadow', '--json')
        issue = json.loads(out)
        self.assertEqual(issue['title'], 'Dedup review: %s (shadow)' % A)
        self.assertIn('shadow: the reviewer would accept', issue['body'])
        self.assertTrue(dr.ISSUE_TITLE.fullmatch(issue['title']))

    def test_plain_output_keeps_non_ascii_text_unescaped(self):
        name = 'Fun Run \U0001F3C3 Bāli ภูเก็ต'
        path = self.write(export_log(export_payload([pair(new=event(name))])))
        code, out, _ = self.issue(path, '--reason', 'unsure')
        self.assertEqual(code, 0)
        self.assertIn(name, out)
        self.assertNotIn('\\u', out)
        self.assertIn('-----BEGIN BODY-----\nDedup review for suggestion', out)
        self.assertTrue(out.rstrip().endswith('-----END BODY-----'))
        self.assertIn(name, json.loads(self.issue(path, '--reason', 'unsure', '--json')[1])['body'])

    def test_rationale_with_shell_syntax_is_only_text(self):
        evil = 'quote $(touch /tmp/pwned) `id` \'x\' "y"; rm -rf /'
        code, out, _ = self.issue(self.write(export_log()), '--reason', 'unsure', rationale=self.rationale(evil))
        self.assertEqual(code, 0)
        self.assertIn('note: ' + evil, out)  # carried inside the fence, never executed by this program
        self.assertFalse(os.path.exists('/tmp/pwned'))

    def test_contacts_are_masked_in_public_text(self):
        new = event('Run info mail organiser@example.org call +62 812-3456-7890', location='Hall (0274) 555 1234 56',
                    links=['wa.me/6281234567890'])
        code, out, _ = self.issue(self.write(export_log(export_payload([pair(new=new)]))), '--reason', 'unsure',
                                  rationale=self.rationale('ask 0812 3456 7890 or a@b.co'))
        self.assertEqual(code, 0)
        for leaked in ('organiser@example.org', '3456-7890', '6281234567890', 'a@b.co', '555 1234 56'):
            self.assertNotIn(leaked, out)
        self.assertIn('[email]', out)
        self.assertIn('[number]', out)
        self.assertIn('2026-11-20', out)  # a date is not a phone number

    def test_inputs_are_validated(self):
        path = self.write(export_log())
        bad = [(('--reason', 'name-mismatch'), {'pattern': 'made-up'}),
               (('--reason', 'name-mismatch'), {'rationale': self.rationale('x' * 201, 'too-long.txt')}),
               (('--reason', 'name-mismatch'), {'rationale': self.rationale(' ', 'blank.txt')}),
               (('--reason', 'name-mismatch'), {'rationale': os.path.join(self.dir.name, 'missing.txt')}),
               (('--reason', 'not-a-code'), {}), ((), {}), (('--shadow', '--reason', 'unsure'), {}),
               (('--reason', 'merge-failed'), {})]  # a live-run code is not an escalation reason
        for extra, kwargs in bad:
            self.assertEqual(self.issue(path, *extra, **kwargs)[0], dr.EXIT_BAD_INPUT, (extra, kwargs))
        self.assertEqual(self.cli('issue', path, '--id', B, '--pattern', 'other', '--rationale-file', self.rationale(), '--shadow')[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('issue', path, '--id', A, '--pattern', 'other', '--rationale', 'inline', '--shadow', '--expect-run-tag', TAG)[0], dr.EXIT_USAGE)  # no argv rationale

    def test_a_cut_list_is_stated_in_the_issue(self):
        many = [dict(event()['schedules'][0], startDate='2026-11-%02d' % (i + 1)) for i in range(15)]
        _, out, _ = self.issue(self.write(export_log(export_payload([pair(new=event(schedules=many))]))), '--reason', 'unsure', '--json')
        body = json.loads(out)['body']
        self.assertIn('Lists cut for length:** 3', body)
        self.assertIn('(+3 more)', body)

    def test_fixed_phrase_comments(self):
        self.assertIn('accepted by a moderator', self.run_cli('comment', 'resolved', '--status', 'accepted', '--by', 'human')[1])
        self.assertIn('pending again', self.run_cli('comment', 'reopened')[1])
        self.assertIn('`name-mismatch`', self.run_cli('comment', 'refused', '--reason', 'name-mismatch')[1])
        for bad in (('resolved',), ('resolved', '--status', 'x', '--by', 'human'), ('refused', '--reason', 'merge-failed'), ('refused', '--reason', 'x\n')):
            self.assertEqual(self.run_cli('comment', *bad)[0], dr.EXIT_BAD_INPUT, bad)

    def summary(self, **over):
        data = {'mode': 'shadow', 'exportTag': TAG, 'validateTag': 't1v', 'applyTag': None,
                'entries': [{'suggestionId': A, 'decision': 'escalated', 'reason': 'name-mismatch', 'pattern': 'other', 'rationale': 'why `x`'},
                            {'suggestionId': B, 'decision': 'shadow-eligible', 'pattern': 'venue-alias'}],
                'closedIssues': [7], 'unknownCount': 1, 'unknownIssues': [9]}
        data.update(over)
        return self.write(json.dumps(data), 'summary.json')

    def test_insight_comment_and_body(self):
        path = self.write(export_log())
        code, out, _ = self.cli('insight-comment', path, '--summary', self.summary())
        self.assertEqual(code, 0)
        self.assertIn('Escalated: 1', out)
        self.assertIn('#7', out)
        self.assertIn('| `%s` | escalated | name-mismatch | other | - |' % A, out)
        code, out, _ = self.cli('insight-body', path, '--status', 'ok', '--oldest-escalation', '2026-11-01T02:59:06Z')
        self.assertEqual(code, 0)
        self.assertIn('Backlog (pending suggestions):** 160', out)
        self.assertIn('2.0 days', out)
        for status in ('frozen', 'blocked', 'failed:export'):
            self.assertEqual(self.cli('insight-body', path, '--status', status)[0], 0, status)
        for bad in ('failed:Bad Step!', 'failed:export\n', 'done', 'ok\n'):
            self.assertEqual(self.cli('insight-body', path, '--status', bad)[0], dr.EXIT_BAD_INPUT, repr(bad))

    def test_a_failed_run_can_be_stamped_without_a_log(self):
        code, out, _ = self.run_cli('insight-body', '--status', 'failed:export')
        self.assertEqual(code, 0)
        self.assertIn('(failed:export)', out)
        self.assertIn('not known (no export)', out)
        self.assertEqual(self.run_cli('insight-body', '--status', 'ok')[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('insight-body', self.write(export_log()), '--status', 'ok')[0], dr.EXIT_USAGE)  # a log needs its tag

    def test_age_is_never_negative_and_a_bad_timestamp_is_refused(self):
        path = self.write(export_log())
        _, out, _ = self.cli('insight-body', path, '--status', 'ok', '--oldest-escalation', '2026-11-09T00:00:00Z')
        self.assertIn('0.0 days', out)
        self.assertNotIn('-0.0', out)
        self.assertEqual(self.cli('insight-body', path, '--status', 'ok', '--oldest-escalation', 'yesterday')[0], dr.EXIT_BAD_INPUT)

    def test_summary_is_validated(self):
        path = self.write(export_log())
        merge = {'suggestionId': A, 'decision': 'merged', 'mergeId': MERGE}
        self.assertEqual(self.cli('insight-comment', path, '--summary', self.summary(mode='live', entries=[merge]))[0], 0)
        self.assertEqual(self.cli('insight-comment', path, '--summary', self.summary(entries=[merge]))[0], dr.EXIT_BAD_INPUT)
        bad_entries = ([{'suggestionId': 'x', 'decision': 'dropped'}], [{'suggestionId': A + '\n', 'decision': 'dropped'}],
                       [{'suggestionId': A, 'decision': 'accepted'}], [{'suggestionId': A, 'decision': 'dropped', 'pattern': 'nope'}],
                       [{'suggestionId': A, 'decision': 'dropped', 'reason': '](http://evil)'}],
                       [{'suggestionId': A, 'decision': 'dropped', 'reason': 'unsure\n'}],
                       [{'suggestionId': A, 'decision': 'dropped', 'rationale': 'y' * 201}])
        for entries in bad_entries:
            self.assertEqual(self.cli('insight-comment', path, '--summary', self.summary(entries=entries))[0], dr.EXIT_BAD_INPUT, entries)
        for field in ({'exportTag': 'bad tag!'}, {'exportTag': 'ok\n'}, {'unknownCount': -1}, {'closedIssues': [0]}):
            self.assertEqual(self.cli('insight-comment', path, '--summary', self.summary(**field))[0], dr.EXIT_BAD_INPUT, field)

    def test_clean_text(self):
        self.assertEqual(dr.clean_text('a‮b​c\x07d\ne\t\tf'), 'ab c d e f'.replace('b c', 'bc'))
        self.assertEqual(dr.clean_text('10K\x0bRun\x0c5K'), '10K Run 5K')      # VT and FF are spaces, not deleted
        self.assertEqual(len(dr.clean_text('x' * 1000)), dr.TEXT_CAP)
        self.assertIsNone(dr.clean_text(None))
        self.assertEqual(dr.fence_for('no ticks'), '```')
        self.assertEqual(dr.fence_for('a ````` b'), '``````')

    def test_invisible_characters_are_removed_and_real_text_survives(self):
        hidden = 'a️b\U000e0100cㅤd⠀e͏f᠋g\U000e0041h'  # variation selectors, fillers, tag character
        self.assertEqual(dr.clean_text(hidden), 'abcdefgh')
        self.assertEqual(dr.clean_text('می‌خواهم'), 'می‌خواهم')  # Persian ZWNJ between letters stays
        self.assertEqual(dr.clean_text('\U0001F468‍\U0001F469'), '\U0001F468‍\U0001F469')  # an emoji sequence stays
        self.assertEqual(dr.clean_text('a ‍ b'), 'a b')                    # a joiner next to a space is dropped
        self.assertEqual(dr.clean_text('Run \U0001FAE9'), 'Run \U0001FAE9')    # a newer emoji is not mistaken for junk


class RealLogProvenanceTests(Base):
    def test_fullmatch_not_dollar_anchor(self):
        for pattern in (dr.UUID, dr.HEX64, dr.RUN_TAG, dr.STEP, dr.ISO_TIME):
            self.assertIsNone(pattern.fullmatch('a\n'))
        self.assertFalse(dr.full(dr.UUID, A + '\n'))
        self.assertTrue(dr.full(dr.UUID, A))


if __name__ == '__main__':
    unittest.main()
