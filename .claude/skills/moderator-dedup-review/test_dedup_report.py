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

sys.dont_write_bytecode = True  # a __pycache__ next to the skill would fail the preflight's clean-tree check
HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = importlib.util.spec_from_file_location('dedup_report', os.path.join(HERE, 'dedup_report.py'))
dr = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dr)

A, B, C = ('00000000-0000-4000-8000-00000000000%d' % i for i in (1, 2, 3))
HEXY = 'abcdef01-0000-4000-8000-00000000000a'  # letters in it: upper-casing changes it, unlike A, B and C
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


def export_payload(pairs=None, resolved=None, run_tag=TAG, skip_resolved=None, total_pending=160, skipped=1, expired=0):
    """A consistent new-shape report: the accounting adds up and the two ages are null exactly when they must be."""
    skip_resolved = skip_resolved or []
    return {
        'schemaVersion': 1, 'generatedAt': '2026-11-03T02:59:06.586Z', 'runTag': run_tag, 'limit': 10,
        'totalPending': total_pending, 'staleCount': 0, 'skippedCount': skipped, 'skipIdCount': skipped + len(skip_resolved),
        'skipResolved': skip_resolved, 'scanLimited': False,
        'oldestPendingAt': None if total_pending == 0 else '2026-10-01T00:00:00.000Z',
        'oldestUnskippedPendingAt': None if total_pending == skipped else '2026-10-20T00:00:00.000Z',
        'pairs': [pair()] if pairs is None else pairs,
        'recentlyResolved': resolved or [], 'recentlyResolvedTruncated': False, 'recentlyExpiredCount': expired,
    }


def skip_row(suggestion_id, status='accepted', by='human', at='2026-11-02T00:00:00.000Z'):
    if status == 'missing':
        return {'suggestionId': suggestion_id, 'status': 'missing', 'resolvedAt': None, 'resolvedBy': None}
    return {'suggestionId': suggestion_id, 'status': status, 'resolvedAt': at, 'resolvedBy': by}


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
        code, out, err = self.cli('export-header', os.environ['DEDUP_REPORT_REAL_LOG'], tag=tag)
        if code == dr.EXIT_BAD_REPORT:  # a log from before FIND-115 must be refused, naming what is missing, never guessed at
            self.assertIn('predates this reader', err)
            return
        self.assertEqual(code, 0)
        pairs = json.loads(out)['pairCount']
        self.assertGreater(pairs, 0)
        self.assertEqual(self.cli('export-pairs', os.environ['DEDUP_REPORT_REAL_LOG'], '0:%d' % pairs, tag=tag)[0], 0)


class ExportCommandTests(Base):
    def test_export_resolved_lists_decisions_and_answers_for_the_ids_asked_about(self):
        d = '00000000-0000-4000-8000-000000000004'
        # B is both a recent decision and a sent id: the two lists describe the same row, so they agree.
        recent = [{'suggestionId': B, 'status': 'rejected', 'resolvedBy': 'reviewer', 'resolvedAt': '2026-11-02T00:00:00.000Z'},
                  {'suggestionId': d, 'status': 'accepted', 'resolvedBy': 'human', 'resolvedAt': '2026-11-02T00:00:00.000Z'}]
        skipped = [skip_row(A, 'expired', 'system'), skip_row(B, 'rejected', 'reviewer'), skip_row(C, 'missing'), skip_row(HEXY)]
        path = self.write(export_log(export_payload([], resolved=recent, skip_resolved=skipped, expired=4)))

        lines = self.cli('export-resolved', path)[1].splitlines()
        self.assertEqual([json.loads(line)['suggestionId'] for line in lines[:-1]], [B, d])     # the default view: the recent decisions
        self.assertEqual(json.loads(lines[-1]), {'shown': 2, 'recentlyResolvedTruncated': False, 'recentlyExpiredCount': 4})

        asked = ','.join([HEXY.upper(), A, B, C, d])        # an upper-case id is folded to lower case before it is looked up
        rows = [json.loads(line) for line in self.cli('export-resolved', path, '--ids', asked)[1].splitlines()[:-1]]
        self.assertEqual([(r['suggestionId'], r['status'], r['resolvedBy']) for r in rows],
                         [(A, 'expired', 'system'), (B, 'rejected', 'reviewer'), (C, 'missing', None), (d, 'accepted', 'human'), (HEXY, 'accepted', 'human')])  # sorted, B once
        code, out, _ = self.cli('export-resolved', path, '--ids', '')                  # a first run has no open issues: show none, do not fail
        self.assertEqual((code, json.loads(out.splitlines()[-1])['shown']), (0, 0))
        for bad in ('nope', A + ',nope', A + 'x'):
            self.assertEqual(self.cli('export-resolved', path, '--ids', bad)[0], dr.EXIT_BAD_INPUT, repr(bad))
        pending = '00000000-0000-4000-8000-0000000000bb'
        summary = json.loads(self.cli('export-resolved', path, '--ids', ','.join([A, pending]))[1].splitlines()[-1])
        self.assertEqual((summary['shown'], summary['notListed']), (1, [pending]))      # an id with no row is named, not silently dropped
        self.assertNotIn('notListed', json.loads(self.cli('export-resolved', path)[1].splitlines()[-1]))
        code, out, _ = self.cli('export-resolved', path, '--ids', ' %s \n' % A)  # whitespace around an id is trimmed, then validated
        self.assertEqual(code, 0)

    def test_decisions_carry_the_exact_hash_and_no_reasons(self):
        path = self.write(export_log(export_payload([pair(HEXY), pair(B)])))
        code, out, _ = self.cli('decisions', path, HEXY.upper(), B)
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)['decisions'][0], {'suggestionId': HEXY, 'evidenceHash': HASH, 'reasons': []})
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

    def test_header_reports_the_queue_ages_the_tallies_and_checks_the_sent_ids(self):
        d, e, f, x = ('00000000-0000-4000-8000-00000000000%d' % i for i in (4, 5, 6, 9))
        rows = [skip_row(A), skip_row(B, 'expired', 'system'), skip_row(C, 'missing')]
        path = self.write(export_log(export_payload([pair(d)], skip_resolved=rows, skipped=2, expired=7)))
        sent = self.write(json.dumps({'ids': [A, B, C, e, f]}), 'sent.json')

        code, out, _ = self.cli('export-header', path, '--sent-file', sent)

        self.assertEqual(code, 0)
        header = json.loads(out)
        self.assertEqual((header['skipIdCount'], header['skippedCount']), (5, 2))
        self.assertEqual(header['skipResolvedByStatus'], {'accepted': 1, 'expired': 1, 'missing': 1})
        self.assertEqual(header['recentlyExpiredCount'], 7)
        self.assertEqual(header['oldestPendingAgeDays'], 33.1)            # 2026-10-01 to 2026-11-03T02:59
        self.assertEqual(header['oldestUnskippedPendingAgeDays'], 14.1)   # 2026-10-20 to 2026-11-03T02:59
        self.assertIn('sent-ids-missing', header['alerts'])
        self.assertEqual(json.loads(self.cli('export-header', path)[1])['skipIdCount'], 5)  # the cross-check is optional

        short = self.write(json.dumps({'ids': [A, B, C, e]}), 'short.json')                   # one fewer id was sent than the export answered for
        stray = self.write(json.dumps({'ids': [A, C, e, f, x]}), 'stray.json')                # B is listed by the export but was not sent
        for bad in (short, stray):
            code, _, err = self.cli('export-header', path, '--sent-file', bad)
            self.assertEqual(code, dr.EXIT_BAD_REPORT, bad)
        self.assertEqual(self.cli('export-header', path, '--sent-file', self.write('{"ids": "no"}', 'bad.json'))[0], dr.EXIT_BAD_INPUT)

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
        return self.run_cli('issue-ids', path, '--max', '200', '--limit', '10', *extra_args)

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

    def test_the_real_issue_ids_output_is_what_sent_file_checks_against(self):
        """No hand-made sent file: what `issue-ids` printed (and the skill saved) is what `--sent-file` reads."""
        sent = self.write(self.ids()[1], 'sent.json')                               # ids [A, B]: A and B are open
        header = lambda payload, sent_file: self.cli('export-header', self.write(export_log(payload)), '--sent-file', sent_file)
        both = export_payload([], skip_resolved=[skip_row(A, 'expired', 'system')], total_pending=1, skipped=1)   # B stays pending
        self.assertEqual(header(both, sent)[0], 0)
        self.assertEqual(json.loads(header(both, sent)[1])['skipIdCount'], 2)
        without_shadow = self.write(self.ids('--exclude-shadow')[1], 'sent-live.json')   # only [A] was sent this time
        code, _, err = header(both, without_shadow)
        self.assertEqual(code, dr.EXIT_BAD_REPORT)                                  # the export answered for 2 ids, 1 was sent
        self.assertIn('answered for 2 ids but 1 were sent', err)

    def test_exclude_shadow_and_cap(self):
        result = json.loads(self.ids('--exclude-shadow')[1])
        self.assertEqual(result['ids'], [A])
        path = self.write(json.dumps(self.listing()), 'i.json')
        capped = json.loads(self.run_cli('issue-ids', path, '--max', '1', '--limit', '1')[1])
        self.assertEqual(capped['ids'], [A])
        self.assertTrue(capped['capped'])
        for bad in ('0', '-1'):
            self.assertEqual(self.run_cli('issue-ids', path, '--max', bad, '--limit', '1')[0], dr.EXIT_BAD_INPUT)
            self.assertEqual(self.run_cli('issue-ids', path, '--max', '5', '--limit', bad)[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('issue-ids', path)[0], dr.EXIT_USAGE)  # --max and --limit are required
        self.assertEqual(self.run_cli('issue-ids', path, '--max', '5')[0], dr.EXIT_USAGE)

    def test_pages_merge_and_content_blocks_are_unwrapped(self):
        page2 = {'issues': [{'number': 9, 'title': 'Dedup review: ' + C, 'state': 'OPEN', 'labels': ['dedup-escalate'], 'created_at': '2026-11-09T00:00:00Z'}]}
        first = self.write(json.dumps(self.listing()), 'p1.json')
        second = self.write(json.dumps([{'type': 'text', 'text': json.dumps(page2)}]), 'p2.json')
        result = json.loads(self.run_cli('issue-ids', first, second, '--max', '200', '--limit', '10')[1])
        self.assertEqual(result['ids'], [A, B, C])

    def test_unrecognised_shapes_fail_loudly(self):
        for label, data in (('no list', {'a': 1}), ('labels as a string', {'issues': [{'title': 't', 'labels': 'dedup-escalate'}]}),
                            ('label without name', {'issues': [{'title': 't', 'labels': [{'id': 1}]}]}), ('entry not an object', {'issues': ['x']})):
            self.assertEqual(self.ids(data=data)[0], dr.EXIT_BAD_INPUT, label)
        self.assertEqual(self.run_cli('issue-ids', self.write('nope', 'x.json'), '--max', '5', '--limit', '1')[0], dr.EXIT_BAD_INPUT)
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
        self.assertIn('Texts or lists cut for length:** 3', body)
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
                'closedIssues': [7]}
        data.update(over)
        return self.write(json.dumps(data), 'summary.json')

    def test_insight_comment_and_body(self):
        path = self.write(export_log())
        code, out, _ = self.cli('insight-comment', path, '--summary', self.summary())
        self.assertEqual(code, 0)
        self.assertIn('Escalated: 1', out)
        self.assertIn('#7', out)
        self.assertIn('| `%s` | escalated | name-mismatch | other | - |' % A, out)
        self.assertIn('Sent ids no longer pending: 0 of 1. Decisions in the last 14 days: 0 (more existed: False). Expired in the last 14 days: 0.', out)
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
        bad_entries = ([{'suggestionId': 'x', 'decision': 'dropped'}], [{'suggestionId': A + '\n', 'decision': 'dropped'}],
                       [{'suggestionId': A, 'decision': 'accepted'}], [{'suggestionId': A, 'decision': 'dropped', 'pattern': 'nope'}],
                       [{'suggestionId': A, 'decision': 'dropped', 'reason': '](http://evil)'}],
                       [{'suggestionId': A, 'decision': 'dropped', 'reason': 'unsure\n'}],
                       [{'suggestionId': A, 'decision': 'dropped', 'rationale': 'y' * 201}],
                       [{'suggestionId': A, 'decision': 'merged', 'mergeId': MERGE}],          # a merge id is never typed in
                       [{'suggestionId': A, 'decision': 'dropped', 'export_tag': 'x'}])        # an unknown key is refused, not ignored
        for entries in bad_entries:
            self.assertEqual(self.cli('insight-comment', path, '--summary', self.summary(entries=entries))[0], dr.EXIT_BAD_INPUT, entries)
        for field in ({'exportTag': 'bad tag!'}, {'exportTag': 'ok\n'}, {'unknownCount': -1}, {'closedIssues': [0]},
                      {'unknownIssues': [9]}, {'export_tag': 'x'}):
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


class PatchRoundTests(Base):
    """Cases found by the second round of reviews."""

    # --- reading
    def test_a_damaged_wrapper_means_cut_not_missing(self):
        damaged = export_log()[:300]  # a saved get_job_logs answer that stops mid-way
        code, _, err = self.cli('export-header', self.write(damaged))
        self.assertEqual(code, dr.EXIT_TRUNCATED)
        self.assertIn('tail_lines', err)

    def test_a_log_saved_as_mcp_content_blocks_is_unwrapped(self):
        blocks = json.dumps([{'type': 'text', 'text': export_log()}])
        self.assertEqual(self.cli('export-header', self.write(blocks))[0], 0)

    def test_a_timestamp_inside_event_text_survives_in_a_log_without_prefixes(self):
        name = 'Final 2026-11-03T02:59:06.5Z Race'
        line = json.dumps(export_payload([pair(new=event(name))]), ensure_ascii=False, separators=(',', ':'))
        raw = '\n'.join([dr.EXPORT_BEGIN, line, dr.EXPORT_END])  # no Actions prefix at all
        code, out, _ = self.cli('export-pairs', self.write(raw), '0:1')
        self.assertEqual(code, 0)
        self.assertIn(name, out)

    def test_the_validator_requires_every_key_the_formatter_reads(self):
        for label, mutate in {
            'location key missing': lambda p: p['pairs'][0]['newEvent'].pop('location'),
            'minDayDiff key missing': lambda p: p['pairs'][0]['signals'].pop('minDayDiff'),
        }.items():
            payload = export_payload([pair()])
            mutate(payload)
            code, _, err = self.cli('issue', self.write(export_log(payload)), '--id', A, '--pattern', 'other', '--reason', 'unsure', '--rationale-file', self.write('r', 'r.txt'))
            self.assertEqual(code, dr.EXIT_BAD_REPORT, label)
            self.assertNotIn('KeyError', err, label)

    def test_header_alerts(self):
        stale = export_payload([], total_pending=5, skipped=0)
        stale['scanLimited'] = True
        self.assertIn('scan-limited-no-pairs', json.loads(self.cli('export-header', self.write(export_log(stale)))[1])['alerts'])
        escalated = export_payload([], total_pending=5, skipped=5)
        self.assertIn('everything-pending-is-already-escalated', json.loads(self.cli('export-header', self.write(export_log(escalated)))[1])['alerts'])
        missing = export_payload(skip_resolved=[skip_row(B, 'missing')])
        self.assertIn('sent-ids-missing', json.loads(self.cli('export-header', self.write(export_log(missing)))[1])['alerts'])
        self.assertEqual(json.loads(self.cli('export-header', self.write(export_log()))[1])['alerts'], [])

    def test_a_huge_range_is_a_usage_error(self):
        self.assertEqual(self.cli('export-pairs', self.write(export_log()), '0:' + '9' * 5000)[0], dr.EXIT_USAGE)

    # --- truncation is always counted
    def test_a_cut_string_is_counted_and_stated(self):
        long_a = 'Same long name ' * 21 + 'Part 1'   # equal for 300+ characters, differing only at the very end
        long_b = 'Same long name ' * 21 + 'Part 2'
        path = self.write(export_log(export_payload([pair(candidate=event(long_a), new=event(long_b))])))
        row = json.loads(self.cli('export-pairs', path, '0:1')[1].splitlines()[-1])
        self.assertGreaterEqual(row['truncated'], 2)
        _, out, _ = self.cli('issue', path, '--id', A, '--pattern', 'other', '--reason', 'unsure', '--rationale-file', self.write('r', 'r.txt'), '--json')
        self.assertNotIn('cut for length:** 0', json.loads(out)['body'])

    # --- masking
    def test_contact_details_are_masked(self):
        for text in ('Tel.02-1234-5678', 'T.010-1234-5678', '(02) 1234-5678', '010–1234–5678', '010/1234/5678',
                     '０１０－１２３４－５６７８', '+82 10 1234 5678',
                     'wa.me/6281234567890', 'user@münchen.de', '홍길동@naver.com', 'a@b.co', '0812 - 3456 - 7890'):
            masked = dr.mask_contacts(text)
            self.assertTrue('[number]' in masked or '[email]' in masked, (text, masked))
            self.assertFalse(re.search(r'[0-9]{4}', masked), (text, masked))

    def test_evidence_is_not_destroyed_by_masking(self):
        for text in ('2026.07.10-07.12', '2026.07.10-12', '2026-07-10 0900', '17.08.2026 06.00', '05.06.2026 10.00', 'Rp 100.000.000',
                     'blog.naver.com/abc/223456789012', 'instagram.com/p/1234567890123/', 'poster@2x.png', 'ig_p_0123456789', 'Day 12 of 365',
                     'Jakarta 10K 2026'):
            self.assertEqual(dr.mask_contacts(text), text, text)

    def test_masking_runs_before_the_length_cap(self):
        # A cap-first implementation would cut at '...john.doe@exam' (no dot, so no longer an address) and leak it.
        text, _ = dr.public_text_ex('x' * 285 + ' john.doe@example.org tail')
        self.assertNotIn('john', text)
        self.assertNotIn('@exam', text)
        self.assertIn('[email]', text)

    def test_a_rationale_that_grows_when_masked_is_accepted(self):
        path = self.write('a@b.co ' * 28, 'many.txt')  # 195 characters, longer once masked
        code, out, _ = self.cli('issue', self.write(export_log()), '--id', A, '--pattern', 'other', '--reason', 'unsure', '--rationale-file', path)
        self.assertEqual(code, 0)
        self.assertIn('[email]', out)

    def test_an_emoji_presentation_selector_survives_after_a_symbol(self):
        self.assertEqual(dr.clean_text('I ❤️ Bali'), 'I ❤️ Bali')
        self.assertEqual(dr.clean_text('a️b'), 'ab')  # but not after a letter
        self.assertEqual(dr.clean_text('1️⃣'), '1️⃣')

    def test_no_bytecode_is_written_next_to_the_skill(self):
        self.assertFalse(os.path.isdir(os.path.join(HERE, '__pycache__')))

    def test_the_day_gap_is_never_printed_as_none(self):
        payload = export_payload([pair()])
        payload['pairs'][0]['signals']['minDayDiff'] = None
        _, out, _ = self.cli('issue', self.write(export_log(payload)), '--id', A, '--pattern', 'other', '--reason', 'unsure', '--rationale-file', self.write('r', 'r.txt'))
        self.assertIn('day gap unknown', out)
        self.assertNotIn('None', out)


class IssueTrustTests(Base):
    def issue_page(self, issues, total=None):
        data = {'issues': issues}
        if total is not None:
            data['totalCount'] = total
        return self.write(json.dumps(data), 'page-%d.json' % len(self.dir.name))

    def row(self, number, suggestion_id, state='OPEN', labels=('dedup-escalate',), created='2026-11-01T00:00:00Z', title=None):
        item = {'number': number, 'title': title or 'Dedup review: ' + suggestion_id, 'state': state, 'labels': list(labels)}
        if created is not None:
            item['created_at'] = created
        return item

    def test_a_listing_without_labels_fails_instead_of_reading_as_empty(self):
        page = self.write(json.dumps({'issues': [{'number': 1, 'title': 'Dedup review: ' + A, 'state': 'OPEN'}]}), 'nolabels.json')
        for command in (('issue-ids', page, '--max', '5', '--limit', '1'), ('settle', self.write(export_log()), page, '--expect-run-tag', TAG)):
            self.assertEqual(self.run_cli(*command)[0], dr.EXIT_BAD_INPUT, command)

    def test_pages_must_add_up_to_the_listings_total(self):
        page1 = self.write(json.dumps({'issues': [self.row(1, A)], 'totalCount': 2}), 'p1.json')
        self.assertEqual(self.run_cli('issue-ids', page1, '--max', '5', '--limit', '1')[0], dr.EXIT_BAD_INPUT)  # a page is missing
        page2 = self.write(json.dumps({'issues': [self.row(2, B)], 'totalCount': 2}), 'p2.json')
        self.assertEqual(self.run_cli('issue-ids', page1, page2, '--max', '5', '--limit', '1')[0], 0)

    def test_an_edited_title_or_an_unfiltered_listing_freezes_the_run(self):
        edited = self.write(json.dumps({'issues': [self.row(1, A, title='[needs info] Dedup review: ' + A)]}), 'edited.json')
        result = json.loads(self.run_cli('issue-ids', edited, '--max', '5', '--limit', '1')[1])
        self.assertTrue(result['frozen'])
        self.assertIn('labelled-issue-not-understood', result['frozenReasons'])
        self.assertEqual(result['labelledIgnored'], [1])
        triage = json.loads(self.cli('triage', self.write(export_log()), edited)[1])
        self.assertTrue(triage['frozen'])
        mixed = self.write(json.dumps({'issues': [self.row(1, A), self.row(2, B, labels=('bug',))]}), 'mixed.json')
        self.assertIn('listing-had-unlabelled-issues', json.loads(self.run_cli('issue-ids', mixed, '--max', '5', '--limit', '1')[1])['frozenReasons'])

    def test_near_the_cap_is_frozen_and_the_numbers_map_is_exact(self):
        page = self.write(json.dumps({'issues': [self.row(1, A), self.row(2, B), self.row(3, B)]}), 'cap.json')
        result = json.loads(self.run_cli('issue-ids', page, '--max', '3', '--limit', '2')[1])
        self.assertIn('near-cap', result['frozenReasons'])
        self.assertEqual(result['numbers'], {A: [1], B: [2, 3]})  # twins are both listed
        self.assertEqual(result['duplicates'], {B: [2, 3]})
        self.assertFalse(json.loads(self.run_cli('issue-ids', page, '--max', '200', '--limit', '2')[1])['frozen'])

    def test_the_oldest_open_time_skips_issues_without_one(self):
        page = self.write(json.dumps({'issues': [self.row(1, A, created=None), self.row(2, B, created='2026-11-02T00:00:00Z')]}), 'old.json')
        self.assertEqual(json.loads(self.run_cli('issue-ids', page, '--max', '5', '--limit', '1')[1])['oldestOpenCreatedAt'], '2026-11-02T00:00:00Z')

    def test_settle_maps_each_resolved_id_to_its_issue_labels_and_comment(self):
        d, e, f, g = ('00000000-0000-4000-8000-00000000000%d' % i for i in (4, 5, 6, 7))
        recent = [{'suggestionId': f, 'status': 'accepted', 'resolvedBy': 'human', 'resolvedAt': '2026-11-02T00:00:00.000Z'},   # not sent: the recent decisions are the fallback
                  {'suggestionId': g, 'status': 'accepted', 'resolvedBy': 'human', 'resolvedAt': '2026-11-02T00:00:00.000Z'}]  # also answered for below, the same row
        sent = [skip_row(A, 'accepted', 'human', '2026-10-01T00:00:00.000Z'),  # decided long before the 14-day window
                skip_row(B, 'expired', 'system'), skip_row(C, 'missing'), skip_row(g, 'accepted', 'human', '2026-11-02T00:00:00.000Z')]
        log = self.write(export_log(export_payload([], resolved=recent, skip_resolved=sent)))
        page = self.write(json.dumps({'issues': [
            self.row(1, A, labels=('dedup-escalate', 'pattern:other')), self.row(2, B), self.row(3, B), self.row(4, C), self.row(5, A, state='CLOSED'),
            self.row(6, e), self.row(7, f), self.row(8, g)]}), 'settle.json')

        result = json.loads(self.cli('settle', log, page)[1])

        by_number = {item['number']: item for item in result['close']}
        self.assertEqual(sorted(by_number), [1, 2, 3, 7, 8])                                    # the twin of B closes too; E is untouched
        self.assertEqual(sorted(by_number[1]['labels']), ['dedup-escalate', 'outcome:accepted', 'pattern:other'])  # GitHub takes a set; order is irrelevant
        self.assertEqual(by_number[2]['labels'], ['dedup-escalate'])                             # an expiry gets no outcome label
        self.assertIn('accepted by a moderator', by_number[1]['comment'])
        self.assertEqual(sorted(by_number[7]['labels']), ['dedup-escalate', 'outcome:accepted'])  # the fallback closes an id that was not sent
        self.assertEqual(sorted(by_number[8]['labels']), ['dedup-escalate', 'outcome:accepted'])  # in both lists: closed once, one outcome label
        self.assertEqual(result['missing'], [{'number': 4, 'id': C}])                            # reported, never closed
        self.assertEqual(result['closedIds'], 4)                                                # distinct suggestions: A, B, F, G
        self.assertEqual(json.loads(self.cli('settle', log, self.write('{"issues":[]}', 'e.json'))[1])['close'], [])

    def test_only_a_humans_decision_earns_an_outcome_label(self):
        def settled(status, by):
            page = self.write(json.dumps({'issues': [self.row(1, A)]}), 'one.json')
            result = json.loads(self.cli('settle', self.write(export_log(export_payload([], skip_resolved=[skip_row(A, status, by)]))), page)[1])
            return result['close'][0]['labels']

        self.assertEqual(sorted(settled('rejected', 'human')), ['dedup-escalate', 'outcome:rejected'])
        for status, by in (('accepted', 'reviewer'), ('accepted', 'unknown'), ('rejected', 'unknown'), ('expired', 'system')):
            self.assertEqual(settled(status, by), ['dedup-escalate'], (status, by))


    def test_everything_already_escalated_counts_as_blocked(self):
        log = self.write(export_log(export_payload([], total_pending=3, skipped=3)))
        self.assertTrue(json.loads(self.cli('triage', log, self.write('{"issues":[]}', 'e.json'))[1])['blocked'])

    def test_insight_body_shows_both_queue_ages_exactly(self):
        _, body, _ = self.cli('insight-body', self.write(export_log()), '--status', 'ok')
        self.assertIn('**Oldest pending in the queue:** 33.1 days (since 2026-10-01T00:00:00.000Z)', body)
        self.assertIn('**Oldest pending nobody has escalated (the sign the daily review stopped):** 14.1 days (since 2026-10-20T00:00:00.000Z)', body)
        _, none, _ = self.cli('insight-body', self.write(export_log(export_payload([], total_pending=0, skipped=0))), '--status', 'ok')
        self.assertEqual(none.count('none'), 3, 'an empty queue shows none for both ages and for the open escalation')   # 2 ages + "none open"
        self.assertEqual(self.run_cli('insight-body', self.write(export_log()), '--expect-run-tag', TAG, '--status', 'ok', '--issues', 'x.json')[0], dr.EXIT_USAGE)  # the estimate is gone

    def test_verify_issue_compares_title_body_and_labels(self):
        log = self.write(export_log())
        rationale = self.write('same race', 'r.txt')
        args = ('--id', A, '--pattern', 'other', '--reason', 'unsure', '--rationale-file', rationale)
        built = json.loads(self.cli('issue', log, *args, '--json')[1])

        def verify(**over):
            posted = {'title': built['title'], 'body': built['body'], 'labels': [{'name': n} for n in built['labels']]}
            posted.update(over)
            return self.cli('verify-issue', log, *args, '--posted', self.write(json.dumps(posted), 'posted.json'))

        self.assertEqual(verify()[0], 0)
        self.assertEqual(verify(body=built['body'].replace('\n', '\r\n') + '\n')[0], 0)        # GitHub may change line endings
        self.assertEqual(verify(labels=[{'name': 'dedup-escalate'}])[0], dr.EXIT_POSTED_DIFFERS)
        self.assertEqual(verify(title=built['title'] + ' (shadow)')[0], dr.EXIT_POSTED_DIFFERS)
        code, _, err = verify(body=built['body'].replace('same race', 'SAME RACE'))
        self.assertEqual(code, dr.EXIT_POSTED_DIFFERS)
        self.assertIn('body', err)
        self.assertEqual(verify(issue=None)[0], 0)  # extra keys are ignored
        wrapped = self.write(json.dumps({'issue': {'title': built['title'], 'body': built['body'], 'labels': built['labels']}}), 'wrapped.json')
        self.assertEqual(self.cli('verify-issue', log, *args, '--posted', wrapped)[0], 0)

    # --- the run summary is bound to the validated apply report
    def test_merge_ids_come_from_the_apply_report_only(self):
        log = self.write(export_log())
        report = apply_payload('live', [{'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE}], run_tag='t1a')
        apply_path = self.write(apply_log(report), 'apply.txt')
        entries = [{'suggestionId': A, 'decision': 'merged', 'pattern': 'name-language'}]

        def summary(mode='live', entries=entries):
            return self.write(json.dumps({'mode': mode, 'exportTag': TAG, 'validateTag': 't1v', 'applyTag': 't1a', 'entries': entries,
                                          'closedIssues': []}), 'sum.json')

        code, out, _ = self.cli('insight-comment', log, '--summary', summary(), '--apply-log', apply_path, '--apply-run-tag', 't1a')
        self.assertEqual(code, 0)
        self.assertIn('`%s`' % MERGE, out)
        self.assertEqual(self.cli('insight-comment', log, '--summary', summary())[0], dr.EXIT_BAD_INPUT)                    # merged but no apply log
        self.assertEqual(self.cli('insight-comment', log, '--summary', summary('shadow'), '--apply-log', apply_path, '--apply-run-tag', 't1a')[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.cli('insight-comment', log, '--summary', summary(entries=[{'suggestionId': B, 'decision': 'merged'}]),
                                  '--apply-log', apply_path, '--apply-run-tag', 't1a')[0], dr.EXIT_BAD_INPUT)                 # a different merge than reported
        self.assertEqual(self.cli('insight-comment', log, '--summary', summary(entries=[{'suggestionId': A, 'decision': 'deferred'}]),
                                  '--apply-log', apply_path, '--apply-run-tag', 't1a')[0], dr.EXIT_BAD_INPUT)                 # a merge nobody recorded
        self.assertEqual(self.cli('insight-comment', log, '--summary', summary(), '--apply-log', apply_path, '--apply-run-tag', 'wrong')[0], dr.EXIT_BAD_REPORT)


class DecisionLoopTests(Base):
    """`brief` (the popup text), `close-decided` and the `decided` comment of the attended decision loop (FIND-119)."""

    def brief(self, *rest, payload=None, pages=()):
        log = self.write(export_log(payload if payload is not None else export_payload([pair(A, candidate=event('Example Run 10K'), new=event('Example Run 5K'))])))
        code, out, err = self.cli('brief', log, *pages, *rest)
        rows = [json.loads(line) for line in out.splitlines() if line.strip()]
        return code, rows, err

    def row(self, number, suggestion_id, state='OPEN', labels=('dedup-escalate',), shadow=False):
        title = 'Dedup review: %s%s' % (suggestion_id, ' (shadow)' if shadow else '')
        return {'number': number, 'title': title, 'state': state, 'labels': list(labels), 'created_at': '2026-11-01T00:00:00Z'}

    def page(self, *issues):
        return self.write(json.dumps({'issues': list(issues)}), 'page.json')

    def test_the_popup_text_shows_both_events_the_signals_and_what_differs(self):
        code, rows, _ = self.brief('--ids', A)
        self.assertEqual(code, 0)
        row = rows[0]
        self.assertEqual((row['suggestionId'], row['issue'], row['header'], row['truncated']), (A, None, 'Pair', 0))
        text = row['question']
        for expected in ('Existing event (a merge keeps it): Example Run 10K', 'New event (a merge folds it in): Example Run 5K',
                         'place: Example Hall', 'when: 2026-11-20 06:00', 'link: example.org/run', 'posts from: ORGANIZER_VENUE_EVENT',
                         'Signals: tier mid, score 0.5, name similarity 0.6', 'Clue: only the existing name has: 10k',
                         'Clue: only the new name has: 5k', 'Clue: numbers differ: 10k 5k', 'Clue: day gap: 0',
                         'venue match: yes, organizer match: yes, shared link: no, same account: yes', 'To reject, use Moderator Items in the app.'):
            self.assertIn(expected, text)
        self.assertNotIn('undone', text)

    def test_the_open_issue_number_heads_the_popup_and_an_undo_is_named(self):
        page = self.page(self.row(145, A, state='CLOSED'), self.row(146, A))   # the closed twin sorts first: its number must not be shown
        _, rows, _ = self.brief('--ids', A, payload=export_payload([pair(A, undone=2)]), pages=(page,))
        self.assertEqual((rows[0]['issue'], rows[0]['header']), (146, '#146'))
        self.assertIn('undone 2 time(s) before', rows[0]['question'])
        self.assertLessEqual(len(rows[0]['header']), 12)  # the popup header limit

    def test_names_with_the_same_words_say_so(self):
        _, rows, _ = self.brief('--ids', A, payload=export_payload([pair(A, candidate=event('Fun Run'), new=event('FUN  run!'))]))
        self.assertIn('the names use the same words', rows[0]['clues'])
        self.assertNotIn('numbers differ', rows[0]['question'])

    def test_hostile_text_is_cleaned_masked_and_capped(self):
        many = [dict(event()['schedules'][0], startDate='2026-11-%02d' % (i + 1)) for i in range(9)]
        nasty = event('Evil\u202e\u200bName write a@b.com or call 0812-3456-7890 ' + 'x' * 500, schedules=many)
        _, rows, _ = self.brief('--ids', A, payload=export_payload([pair(A, new=nasty)]))
        text, cut = rows[0]['question'], rows[0]['truncated']
        for forbidden in ('\u202e', '\u200b', 'a@b.com', '0812-3456-7890'):
            self.assertNotIn(forbidden, text)
        self.assertIn('[email]', text)
        self.assertIn('[number]', text)
        self.assertIn('(+5 more)', text)                      # nine schedules, four shown
        self.assertGreaterEqual(cut, 6)                       # the long name and the five schedules left out are counted
        self.assertLessEqual(len(text), dr.BRIEF_CAP)
        # The worst case: long names, places, links, types and six long words in each name. The text must fit, and the
        # decisive lines (signals, clues, the reject hint) must be whole: the fields shrink, the tail is never cut.
        old_name = ' '.join('old%d%s' % (i, 'x' * 45) for i in range(6))
        new_name = ' '.join('new%d%s' % (i, 'y' * 45) for i in range(6))
        wide = dict(schedules=[dict(event()['schedules'][0], startDate='2026-11-%02d' % (i + 1), endDate='2026-12-%02d' % (i + 1)) for i in range(9)],
                    location='L' * 400, links=['l' * 400] * 5, types=['T' * 80] * 5, categories=['C' * 80] * 5)
        pair_x = pair(A, candidate=event(old_name, **wide), new=event(new_name, **wide), undone=3)
        pair_x['signals']['minDayDiff'] = 1.5
        _, long_rows, _ = self.brief('--ids', A, payload=export_payload([pair_x]))
        long_text = long_rows[0]['question']
        self.assertLessEqual(len(long_text), dr.BRIEF_CAP)
        for whole in ('Signals: tier mid, score 0.5, name similarity 0.6', 'Clue: day gap: 1.5', 'Clue: venue match: yes, organizer match: yes, shared link: no, same account: yes',
                      'Clue: a merge of this pair was undone 3 time(s) before', 'To reject, use Moderator Items in the app.', 'Text was cut for length in'):
            self.assertIn(whole, long_text)
        self.assertGreaterEqual(long_rows[0]['truncated'], 1)

    def test_the_popup_names_the_end_date_the_type_and_every_open_issue(self):
        multi = event(types=['RACE'], categories=['SPORTS_AND_FITNESS'], schedules=[dict(event()['schedules'][0], startDate='2026-11-20', endDate='2026-11-22')])
        page = self.page(self.row(146, A), self.row(147, A, shadow=True), self.row(148, A, state='CLOSED'))
        _, rows, _ = self.brief('--ids', A, payload=export_payload([pair(A, new=multi)]), pages=(page,))
        text = rows[0]['question']
        self.assertIn('when: 2026-11-20 06:00 to 2026-11-22', text)
        self.assertIn('type: RACE, SPORTS_AND_FITNESS; detail: full', text)
        self.assertEqual((rows[0]['issue'], rows[0]['issues']), (146, [146, 147]))
        self.assertIn('Open issues for this pair: #146, #147', text)

    def test_the_same_words_clue_is_never_a_false_assurance(self):
        def clues(old, new):
            every = self.brief('--ids', A, payload=export_payload([pair(A, candidate=event(old), new=event(new))]))[1][0]['clues']
            return [clue for clue in every if not clue.startswith(('day gap', 'venue match', 'a merge'))]  # the name clues only

        phones = clues('Run call 0812-3456-7890', 'Run call 0899-1111-2222')                  # two different numbers are two different words
        self.assertEqual(phones[:3], ['only the existing name has: 0812 3456 7890', 'only the new name has: 0899 1111 2222',
                                      'numbers differ: 0812 3456 7890 0899'])  # at most four numbers; the two lines above show them all
        tail = 'z' * 400
        self.assertIn('only the new name has: ' + 'b' * 20, ' '.join(clues('a ' * 3 + tail, 'a ' * 3 + tail + ' ' + 'b' * 30)))  # a difference past the 300th character
        for old, new in (('!!!', '???'), ('★★★', '---'), ('', 'Run')):
            self.assertEqual(clues(old, new), ['a name has no letters or digits: compare the events themselves'], (old, new))
        self.assertEqual(clues('Stra\u00dfe Run', 'STRASSE run'), ['the names use the same words'])             # case-folded, not just lower-cased
        self.assertEqual(clues('Run 10K', 'Run 5K'), ['only the existing name has: 10k', 'only the new name has: 5k', 'numbers differ: 10k 5k'])

    def test_a_day_gap_that_cannot_be_true_is_refused_by_the_report_check(self):
        for gap in (10 ** 400, float('nan'), float('inf'), -3, 100001):
            p = pair(A)
            p['signals']['minDayDiff'] = gap
            code, _, err = self.brief('--ids', A, payload=export_payload([p]))
            self.assertEqual(code, dr.EXIT_BAD_REPORT, gap)
            self.assertIn('minDayDiff must be between 0 and 100000', err)
        p = pair(A)
        p['signals']['minDayDiff'] = 2.0
        self.assertIn('Clue: day gap: 2\n', self.brief('--ids', A, payload=export_payload([p]))[1][0]['question'])

    def test_ids_must_be_exported_pairs_listed_once_and_upper_case_is_folded(self):
        payload = export_payload([pair(HEXY)])
        _, rows, _ = self.brief('--ids', HEXY.upper(), payload=payload)
        self.assertEqual(rows[0]['suggestionId'], HEXY)
        self.assertEqual(self.brief('--ids', B, payload=payload)[0], dr.EXIT_BAD_INPUT)                 # not an exported pair
        self.assertEqual(self.brief('--ids', '%s,%s' % (HEXY, HEXY.upper()), payload=payload)[0], dr.EXIT_BAD_INPUT)  # twice
        self.assertEqual(self.brief(payload=payload)[0], dr.EXIT_BAD_INPUT)                             # no ids
        self.assertEqual(self.brief('--ids', 'nope', payload=payload)[0], dr.EXIT_BAD_INPUT)

    def decided(self, results, issues, tag='t1a', ids=None, mode='live', logged='t1a'):
        """`logged` is the run tag the apply log carries, `tag` the one the caller says it dispatched."""
        log = self.write(apply_log(apply_payload(mode, results, run_tag=logged)))
        wanted = ids if ids is not None else ','.join(r['suggestionId'] for r in results)
        return self.run_cli('close-decided', log, self.page(*issues), '--expect-run-tag', tag, '--expect-ids', wanted)

    def test_close_decided_lists_the_open_issues_of_merged_pairs_only(self):
        merged = {'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE}
        refused = {'suggestionId': B, 'outcome': 'skipped', 'reason': 'concurrent-change'}
        no_issue = {'suggestionId': C, 'outcome': 'merged', 'mergeId': '22222222-2222-4222-8222-222222222222'}
        issues = [self.row(1, A, labels=('dedup-escalate', 'pattern:other')), self.row(2, B), self.row(3, A, shadow=True),
                  self.row(4, A, state='CLOSED'), self.row(5, A, labels=('dedup-escalate', 'outcome:accepted'))]

        code, out, _ = self.decided([merged, refused, no_issue], issues)

        self.assertEqual(code, 0)
        result = json.loads(out)
        by_number = {item['number']: item for item in result['close']}
        self.assertEqual(sorted(by_number), [1, 3, 5])                                  # B was not merged, issue 4 is already closed
        self.assertEqual(by_number[1]['labels'], ['dedup-escalate', 'pattern:other', 'outcome:accepted'])
        self.assertEqual(by_number[5]['labels'].count('outcome:accepted'), 1)           # never twice
        mixed = json.loads(self.decided([merged], [self.row(9, A, labels=('dedup-escalate', 'outcome:rejected', 'dedup-learned'))])[1])['close'][0]['labels']
        self.assertEqual(mixed, ['dedup-escalate', 'dedup-learned', 'outcome:accepted'])  # a contradicting outcome label is replaced, other labels stay
        self.assertIn('merge `%s`' % MERGE, by_number[1]['comment'])
        self.assertIn('a moderator accepted this suggestion in an attended review session', by_number[1]['comment'])
        self.assertEqual(result['closedIds'], 1)
        self.assertEqual(result['notMerged'], [{'id': B, 'reason': 'concurrent-change'}])
        self.assertEqual(result['mergedWithoutOpenIssue'], [C])

    def test_close_decided_trusts_only_a_live_apply_report_for_the_dispatched_run(self):
        merged = {'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE}
        issues = [self.row(1, A)]
        self.assertEqual(self.decided([merged], issues, tag='other')[0], dr.EXIT_BAD_REPORT)             # a log from another run
        self.assertEqual(self.decided([merged], issues, ids='%s,%s' % (A, B))[0], dr.EXIT_BAD_REPORT)   # not the dispatched set
        self.assertEqual(self.decided([{'suggestionId': A, 'outcome': 'eligible'}], issues, mode='validate')[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.decided([merged], issues, ids='nope')[0], dr.EXIT_BAD_INPUT)
        out = json.loads(self.decided([{'suggestionId': A, 'outcome': 'skipped', 'reason': 'per-day-cap'}], issues)[1])
        self.assertEqual((out['close'], out['closedIds']), ([], 0))                                       # nothing merged, nothing closed

    def test_the_decided_comment_is_a_fixed_phrase_with_a_validated_merge_id(self):
        letters = 'ABCDEF12-1111-4111-8111-111111111111'
        code, out, _ = self.run_cli('comment', 'decided', '--merge-id', letters)
        self.assertEqual(code, 0)
        self.assertIn('merge `abcdef12-1111-4111-8111-111111111111`', out)
        for bad in (None, 'nope', MERGE + '`; rm -rf'):
            argv = ['comment', 'decided'] + (['--merge-id', bad] if bad else [])
            self.assertEqual(self.run_cli(*argv)[0], dr.EXIT_BAD_INPUT, bad)


class ExportContractTests(Base):
    """The rules the reader holds a report to: every new key, the sum, the shape of skipResolved, the null rules."""

    def load(self, payload):
        return self.cli('export-header', self.write(export_log(payload)))

    def test_an_export_without_a_new_key_is_refused_and_the_key_is_named(self):
        for key in ('skipIdCount', 'skipResolved', 'recentlyExpiredCount', 'oldestPendingAt', 'oldestUnskippedPendingAt'):
            payload = export_payload()
            del payload[key]
            code, _, err = self.load(payload)
            self.assertEqual(code, dr.EXIT_BAD_REPORT, key)
            self.assertIn("'%s'" % key, err)
            self.assertIn('predates this reader', err)

    def test_the_sum_of_pending_and_resolved_must_be_the_number_of_ids_sent(self):
        payload = export_payload(skip_resolved=[skip_row(B)])
        self.assertEqual(self.load(payload)[0], 0)
        payload['skipIdCount'] += 1
        code, _, err = self.load(payload)
        self.assertEqual(code, dr.EXIT_BAD_REPORT)
        self.assertIn('accounting is off', err)

    def test_skip_resolved_rows_must_have_the_documented_shape(self):
        cases = {  # label: (the rows, the part of the message that names the rule that must fire)
            'a missing row with a time': ([dict(skip_row(B, 'missing'), resolvedAt='2026-11-02T00:00:00.000Z')], 'null time and class'),
            'a missing row with a class': ([dict(skip_row(B, 'missing'), resolvedBy='human')], 'null time and class'),
            'a resolved row without a class': ([dict(skip_row(B), resolvedBy=None)], 'needs its class'),
            'a status that does not exist': ([dict(skip_row(B), status='pending')], 'bad status'),
            'a bad class': ([dict(skip_row(B), resolvedBy='robot')], 'bad resolvedBy'),
            'a bad time': ([dict(skip_row(B), resolvedAt='yesterday')], 'skipResolved resolvedAt'),
            'not sorted': ([skip_row(C), skip_row(B)], 'sorted by id'),
            'a duplicate': ([skip_row(B), skip_row(B)], 'sorted by id'),
            'also an exported pair': ([skip_row(A)], 'also be an exported pair'),  # the default fixture exports a pair with id A
            'a key missing': ([{'suggestionId': B, 'status': 'accepted', 'resolvedBy': 'human'}], "a skipResolved row has no 'resolvedAt'"),
            'not an object': (['x'], 'bad suggestionId'),
        }
        for label, (rows, rule) in cases.items():
            payload = export_payload(skip_resolved=rows)
            payload['skipIdCount'] = payload['skippedCount'] + len(rows)  # keep the sum right so only the shape is wrong
            code, _, err = self.load(payload)
            self.assertEqual(code, dr.EXIT_BAD_REPORT, label)
            self.assertIn(rule, err, label)
            self.assertNotIn('Traceback', err, label)
            self.assertNotIn('predates', err, label)  # a malformed row is not an old export

    def test_the_ages_are_null_exactly_when_the_counts_say_so(self):
        def refused(payload, rule):
            code, _, err = self.load(payload)
            self.assertEqual(code, dr.EXIT_BAD_REPORT, rule)
            self.assertIn(rule, err)

        nothing_pending = export_payload([], total_pending=0, skipped=0)
        self.assertEqual(self.load(nothing_pending)[0], 0)
        refused(dict(nothing_pending, oldestPendingAt='2026-10-01T00:00:00.000Z'), 'oldestPendingAt must be null exactly when nothing is pending')
        refused(dict(export_payload(), oldestPendingAt=None), 'oldestPendingAt must be null exactly when nothing is pending')
        all_sent = export_payload([], total_pending=3, skipped=3)
        self.assertEqual(self.load(all_sent)[0], 0)
        refused(dict(all_sent, oldestUnskippedPendingAt='2026-10-20T00:00:00.000Z'), 'oldestUnskippedPendingAt must be null exactly when')
        refused(dict(export_payload(), oldestUnskippedPendingAt=None), 'oldestUnskippedPendingAt must be null exactly when')
        refused(dict(export_payload(), oldestPendingAt='not a time'), 'oldestPendingAt must be an ISO timestamp or null')

    def test_a_row_level_key_that_is_missing_does_not_blame_the_export_version(self):
        row = skip_row(B)
        del row['resolvedAt']
        payload = export_payload(skip_resolved=[row])
        code, _, err = self.load(payload)
        self.assertEqual(code, dr.EXIT_BAD_REPORT)
        self.assertIn("a skipResolved row has no 'resolvedAt'", err)

    def test_impossible_times_and_counts_are_refused(self):
        def refused(payload, rule):
            code, _, err = self.load(payload)
            self.assertEqual(code, dr.EXIT_BAD_REPORT, rule)
            self.assertIn(rule, err)

        refused(dict(export_payload(), oldestPendingAt='2026-13-45T00:00:00.000Z'), 'oldestPendingAt must be an ISO timestamp or null')   # the shape of a time, not a time
        refused(dict(export_payload(), generatedAt='2026-02-30T00:00:00.000Z'), 'generatedAt must be an ISO timestamp')
        bad_row = {'suggestionId': B, 'status': 'accepted', 'resolvedBy': 'human', 'resolvedAt': '2026-00-10T00:00:00.000Z'}
        refused(export_payload(resolved=[bad_row]), 'a resolved row has a bad resolvedAt')
        refused(dict(export_payload([], total_pending=1, skipped=2), skipIdCount=2), 'more than totalPending')          # more sent ids pending than pending rows
        refused(dict(export_payload([pair(A), pair(B)], total_pending=2, skipped=1), skipIdCount=1), 'more than totalPending')  # 2 pairs + 1 skipped > 2 pending

    def test_an_expiry_in_the_list_of_decisions_is_refused(self):
        expired = {'suggestionId': B, 'status': 'expired', 'resolvedBy': 'system', 'resolvedAt': '2026-11-02T00:00:00.000Z'}
        code, _, err = self.load(export_payload(resolved=[expired]))
        self.assertEqual(code, dr.EXIT_BAD_REPORT)
        self.assertIn('recentlyExpiredCount', err)
        self.assertEqual(self.load(export_payload(expired=-1))[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.load(dict(export_payload(), skipIdCount=-1))[0], dr.EXIT_BAD_REPORT)


if __name__ == '__main__':
    unittest.main()
