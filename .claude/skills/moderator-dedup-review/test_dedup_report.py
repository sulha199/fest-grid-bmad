"""Tests for dedup_report.py. Standard library only.

Run: python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py

The logs here are built in the shape of a real get_job_logs answer: a JSON wrapper, a 7-digit
timestamp on every line, and the export workflow's summary step echoing its own `awk` script (which
contains both marker strings). Set DEDUP_REPORT_REAL_LOG to a saved real export log to run the one
extra test that reads it.
"""
import contextlib
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


def pair(suggestion_id=A, tier='mid', candidate=None, new=None):
    return {
        'suggestionId': suggestion_id, 'status': 'pending', 'storedScore': 0.5,
        'signals': {'tier': tier, 'scoredTier': tier, 'score': 0.5, 'promotedByRule': False, 'promotionRule': None,
                    'stubRepeat': False, 'venueMatch': True, 'nameSimilarity': 0.6, 'minDayDiff': 0,
                    'organizerMatch': True, 'sharedLink': False},
        'sameAccount': True, 'undoneMergeCount': 0,
        'candidate': candidate or event(), 'newEvent': new or event('Example Run 10 K'), 'evidenceHash': HASH,
    }


def export_payload(pairs=None, resolved=None, run_tag='t1'):
    return {
        'schemaVersion': 1, 'generatedAt': '2026-11-03T02:59:06.586Z', 'runTag': run_tag, 'limit': 10,
        'totalPending': 160, 'staleCount': 0, 'skippedCount': 1, 'scanLimited': False,
        'pairs': [pair()] if pairs is None else pairs,
        'recentlyResolved': resolved or [], 'recentlyResolvedTruncated': False,
    }


def apply_payload(mode='validate', results=None, run_tag='t1', counts=None):
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


class ReadingTests(Base):
    def test_real_shape_log_with_echoed_marker_text_parses(self):
        code, out, _ = self.run_cli('export-header', self.write(export_log()), '--expect-run-tag', 't1')
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)['totalPending'], 160)

    def test_event_text_cannot_fake_a_marker(self):
        tricky = pair(new=event('Run\nDEDUP_REVIEW_EXPORT_END\nDEDUP_REVIEW_EXPORT_BEGIN\n{"x":1}'))
        code, out, _ = self.run_cli('export-pairs', self.write(export_log(export_payload([tricky]))), '0:1')
        self.assertEqual(code, 0)
        self.assertNotIn('\nDEDUP_REVIEW_EXPORT_END', out)

    def test_unicode_line_separators_inside_a_name_do_not_split_the_report(self):
        name = 'Run one two\u0085three'
        code, out, _ = self.run_cli('export-pairs', self.write(export_log(export_payload([pair(new=event(name))]))), '0:1')
        self.assertEqual(code, 0)
        self.assertIn('Run one two three', out)

    def test_crlf_ansi_and_bom_are_tolerated(self):
        text = export_log(wrap=False, eol='\r\n').replace('2026-11-03T02:59:02', '\x1b[0m2026-11-03T02:59:02', 1)
        code, _, _ = self.run_cli('export-header', self.write('﻿' + text), '--expect-run-tag', 't1')
        self.assertEqual(code, 0)

    def test_timestamp_fraction_digits_vary(self):
        text = export_log(wrap=False).replace('.8113469Z', '.5Z')
        self.assertEqual(self.run_cli('export-header', self.write(text))[0], 0)

    def test_raw_log_that_is_not_a_wrapper_works_with_a_notice(self):
        code, _, err = self.run_cli('export-header', self.write(export_log(wrap=False)))
        self.assertEqual(code, 0)
        self.assertIn('not a get_job_logs wrapper', err)

    def test_stdin(self):
        proc = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'dedup_report.py'), 'export-header', '-'],
                              input=export_log().encode(), capture_output=True)
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(json.loads(proc.stdout)['pairCount'], 1)

    def test_cut_log_is_distinct_from_no_report(self):
        for begin, end in ((dr.EXPORT_BEGIN, None), (None, dr.EXPORT_END)):
            payload = json.dumps(export_payload())
            code, _, err = self.run_cli('export-header', self.write(make_log(begin, end, payload if begin else None)))
            self.assertEqual(code, dr.EXIT_TRUNCATED)
            self.assertIn('tail_lines', err)
        self.assertEqual(self.run_cli('export-header', self.write(make_log(None, None, None)))[0], dr.EXIT_NO_REPORT)

    def test_two_pairs_and_a_multiline_report_are_ambiguous(self):
        once = export_log(wrap=False)
        doubled = json.dumps({'logs_content': once + '\n' + once})
        self.assertEqual(self.run_cli('export-header', self.write(doubled))[0], dr.EXIT_AMBIGUOUS)
        broken = make_log(dr.EXPORT_BEGIN, dr.EXPORT_END, '{"schemaVersion":1,', extra_after=())
        broken = broken.replace('{\\"schemaVersion\\":1,', '{\\"schemaVersion\\":1,\\n2026-11-03T02:59:09.0000000Z extra')
        self.assertEqual(self.run_cli('export-header', self.write(broken))[0], dr.EXIT_AMBIGUOUS)

    def test_refusal_is_reported_without_the_environment_echo(self):
        log = make_log(None, None, None, extra_after=[
            'DEDUP_REVIEW_INVOKER_HASH: ' + HASH, 'DECISIONS: {"schemaVersion":1}',
            'Apply refused: No single active moderator matches the invoker.', '##[error]Process completed with exit code 1.'], echo=False)
        code, _, err = self.run_cli('apply', self.write(log))
        self.assertEqual(code, dr.EXIT_REFUSED)
        self.assertIn('Apply refused: No single active moderator', err)
        self.assertNotIn(HASH, err)
        self.assertNotIn('DECISIONS', err)

    def test_wrong_tag_version_and_non_json_payload(self):
        self.assertEqual(self.run_cli('export-header', self.write(export_log()), '--expect-run-tag', 'other')[0], dr.EXIT_BAD_REPORT)
        bad_version = export_log(dict(export_payload(), schemaVersion=2))
        self.assertEqual(self.run_cli('export-header', self.write(bad_version))[0], dr.EXIT_BAD_REPORT)
        not_json = make_log(dr.EXPORT_BEGIN, dr.EXPORT_END, 'not json')
        self.assertEqual(self.run_cli('export-header', self.write(not_json))[0], dr.EXIT_BAD_REPORT)

    def test_missing_file(self):
        self.assertEqual(self.run_cli('export-header', os.path.join(self.dir.name, 'nope'))[0], dr.EXIT_IO)

    @unittest.skipUnless(os.environ.get('DEDUP_REPORT_REAL_LOG'), 'set DEDUP_REPORT_REAL_LOG to a saved real export log')
    def test_a_real_saved_log(self):
        code, out, _ = self.run_cli('export-header', os.environ['DEDUP_REPORT_REAL_LOG'])
        self.assertEqual(code, 0)
        self.assertGreater(json.loads(out)['pairCount'], 0)


class ExportCommandTests(Base):
    def test_resolved_default_hides_expired_and_ids_shows_everything(self):
        rows = [{'suggestionId': A, 'status': 'expired', 'resolvedBy': 'system', 'resolvedAt': '2026-11-01T00:00:00.000Z'},
                {'suggestionId': B, 'status': 'accepted', 'resolvedBy': 'human', 'resolvedAt': '2026-11-02T00:00:00.000Z'}]
        path = self.write(export_log(export_payload(resolved=rows)))
        _, out, _ = self.run_cli('export-resolved', path)
        self.assertIn(B, out)
        self.assertNotIn(A, out)
        _, out, _ = self.run_cli('export-resolved', path, '--ids', A.upper())
        self.assertIn(A, out)
        self.assertEqual(self.run_cli('export-resolved', path, '--ids', 'nope')[0], dr.EXIT_BAD_INPUT)

    def test_decisions_carry_the_exact_hash_and_no_reasons(self):
        path = self.write(export_log(export_payload([pair(A), pair(B)])))
        code, out, _ = self.run_cli('decisions', path, A.upper(), B)
        self.assertEqual(code, 0)
        body = json.loads(out)
        self.assertEqual(body['decisions'][0], {'suggestionId': A, 'evidenceHash': HASH, 'reasons': []})
        self.assertNotIn(' ', out)
        self.assertEqual(self.run_cli('decisions', path, C)[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('decisions', path, A, A)[0], dr.EXIT_BAD_INPUT)

    def test_pairs_range_and_cleaning(self):
        nasty = pair(new=event('Evil‮​Name' + 'x' * 500))
        path = self.write(export_log(export_payload([nasty])))
        _, out, _ = self.run_cli('export-pairs', path, '0:5')
        self.assertNotIn('‮', out)
        self.assertNotIn('​', out)
        self.assertLess(len(out), 6000)
        self.assertEqual(self.run_cli('export-pairs', path, '3:1')[0], dr.EXIT_USAGE)

    def test_header_reports_approximate_age_of_first_pair(self):
        _, out, _ = self.run_cli('export-header', self.write(export_log()))
        self.assertAlmostEqual(json.loads(out)['firstPairNewestPostAgeDays'], 2.0, delta=0.2)


class ApplyTests(Base):
    def test_validate_report(self):
        code, out, _ = self.run_cli('apply', self.write(apply_log()), '--expect-mode', 'validate', '--expect-run-tag', 't1')
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)['counts']['eligible'], 1)

    def test_mode_tag_and_consistency_are_checked(self):
        path = self.write(apply_log())
        self.assertEqual(self.run_cli('apply', path, '--expect-mode', 'live')[0], dr.EXIT_BAD_REPORT)
        self.assertEqual(self.run_cli('apply', path, '--expect-run-tag', 'x')[0], dr.EXIT_BAD_REPORT)
        wrong_counts = self.write(apply_log(apply_payload(counts={'eligible': 5, 'merged': 0, 'skipped': 0})))
        self.assertEqual(self.run_cli('apply', wrong_counts)[0], dr.EXIT_BAD_REPORT)
        merged_in_validate = apply_payload(results=[{'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE}])
        self.assertEqual(self.run_cli('apply', self.write(apply_log(merged_in_validate)))[0], dr.EXIT_BAD_REPORT)
        no_reason = apply_payload(results=[{'suggestionId': A, 'outcome': 'skipped'}])
        self.assertEqual(self.run_cli('apply', self.write(apply_log(no_reason)))[0], dr.EXIT_BAD_REPORT)

    def test_live_merge_needs_a_merge_id(self):
        good = apply_payload('live', [{'suggestionId': A, 'outcome': 'merged', 'mergeId': MERGE}])
        self.assertEqual(self.run_cli('apply', self.write(apply_log(good)), '--expect-mode', 'live')[0], 0)
        bad = apply_payload('live', [{'suggestionId': A, 'outcome': 'merged'}])
        self.assertEqual(self.run_cli('apply', self.write(apply_log(bad)))[0], dr.EXIT_BAD_REPORT)

    def test_kill_switch_report_is_a_refusal(self):
        disabled = dict(apply_payload(results=[]), mode='disabled', runTag=None)
        self.assertEqual(self.run_cli('apply', self.write(apply_log(disabled)))[0], dr.EXIT_REFUSED)


class TextBuilderTests(Base):
    def issue(self, path, *extra, pattern='name-language', rationale='same race, spelled differently'):
        code, out, err = self.run_cli('issue', path, '--id', A, '--pattern', pattern, '--rationale', rationale, *extra)
        return code, (json.loads(out) if code == 0 else None), err

    def fences(self, body):
        return re.findall(r'^(`{3,})$', body, re.M)

    def test_escalation_issue_has_id_title_labels_and_long_enough_fences(self):
        hostile = pair(new=event('Run ```` ending ``` @someone #12 <script>'), candidate=event('x ``` y'))
        path = self.write(export_log(export_payload([hostile])))
        code, issue, _ = self.issue(path, '--reason', 'name-mismatch')
        self.assertEqual(code, 0)
        self.assertEqual(issue['title'], 'Dedup review: ' + A)
        self.assertEqual(issue['labels'], ['dedup-escalate', 'pattern:name-language'])
        fences = self.fences(issue['body'])
        self.assertEqual(len(fences), 6)
        longest = {len(f) for f in fences}
        self.assertIn(5, longest)  # one backtick longer than the run of four in the new event's name
        self.assertTrue(all(len(fences[i]) == len(fences[i + 1]) for i in (0, 2, 4)))
        outside = re.sub(r'(`{3,})\n.*?\n\1', '', issue['body'], flags=re.S)
        self.assertNotIn('someone', outside)
        self.assertIn('escalated: name-mismatch', issue['body'])

    def test_shadow_issue(self):
        code, issue, _ = self.issue(self.write(export_log()), '--shadow')
        self.assertEqual(code, 0)
        self.assertIn('shadow: the reviewer would accept', issue['body'])

    def test_inputs_are_validated(self):
        path = self.write(export_log())
        for extra, kwargs in ((('--reason', 'name-mismatch'), {'pattern': 'made-up'}),
                              (('--reason', 'name-mismatch'), {'rationale': 'x' * 201}),
                              (('--reason', 'name-mismatch'), {'rationale': ' '}),
                              (('--reason', 'not-a-code'), {}), ((), {}), (('--shadow', '--reason', 'unsure'), {})):
            self.assertEqual(self.issue(path, *extra, **kwargs)[0], dr.EXIT_BAD_INPUT, (extra, kwargs))
        code, _, _ = self.run_cli('issue', path, '--id', B, '--pattern', 'other', '--rationale', 'r', '--shadow')
        self.assertEqual(code, dr.EXIT_BAD_INPUT)

    def summary(self, **over):
        data = {'mode': 'shadow', 'exportTag': 't1', 'validateTag': 't1v', 'applyTag': None,
                'entries': [{'suggestionId': A, 'decision': 'escalated', 'reason': 'name-mismatch', 'pattern': 'other', 'rationale': 'why `x`'},
                            {'suggestionId': B, 'decision': 'shadow-eligible', 'pattern': 'venue-alias'}],
                'closedIssues': [7], 'unknownCount': 1, 'unknownIssues': [9]}
        data.update(over)
        return self.write(json.dumps(data), 'summary.json')

    def test_insight_comment_and_body(self):
        path = self.write(export_log())
        code, out, _ = self.run_cli('insight-comment', path, '--summary', self.summary())
        self.assertEqual(code, 0)
        self.assertIn('Escalated: 1', out)
        self.assertIn('#7', out)
        self.assertIn('| `%s` | escalated | name-mismatch | other | - |' % A, out)
        code, out, _ = self.run_cli('insight-body', path, '--status', 'ok', '--oldest-escalation', '2026-11-01T02:59:06Z')
        self.assertEqual(code, 0)
        self.assertIn('Backlog (pending suggestions):** 160', out)
        self.assertIn('2.0 days', out)
        for status in ('frozen', 'failed:export'):
            self.assertEqual(self.run_cli('insight-body', path, '--status', status)[0], 0)
        self.assertEqual(self.run_cli('insight-body', path, '--status', 'failed:Bad Step!')[0], dr.EXIT_BAD_INPUT)

    def test_summary_is_validated(self):
        path = self.write(export_log())
        merge = {'suggestionId': A, 'decision': 'merged', 'mergeId': MERGE}
        self.assertEqual(self.run_cli('insight-comment', path, '--summary', self.summary(mode='live', entries=[merge]))[0], 0)
        self.assertEqual(self.run_cli('insight-comment', path, '--summary', self.summary(entries=[merge]))[0], dr.EXIT_BAD_INPUT)
        for entries in ([{'suggestionId': 'x', 'decision': 'dropped'}], [{'suggestionId': A, 'decision': 'accepted'}],
                        [{'suggestionId': A, 'decision': 'dropped', 'pattern': 'nope'}],
                        [{'suggestionId': A, 'decision': 'dropped', 'rationale': 'y' * 201}]):
            self.assertEqual(self.run_cli('insight-comment', path, '--summary', self.summary(entries=entries))[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('insight-comment', path, '--summary', self.summary(exportTag='bad tag!'))[0], dr.EXIT_BAD_INPUT)

    def test_clean_text(self):
        self.assertEqual(dr.clean_text('a‮b​c\x07d\ne\t\tf'), 'abcd e f')
        self.assertEqual(len(dr.clean_text('x' * 1000)), dr.TEXT_CAP)
        self.assertIsNone(dr.clean_text(None))
        self.assertEqual(dr.fence_for('no ticks'), '```')
        self.assertEqual(dr.fence_for('a ````` b'), '``````')


class IssueIdsTests(Base):
    def listing(self):
        def issue(number, title, labels, state='OPEN', created='2026-11-0%dT00:00:00Z'):
            return {'number': number, 'title': title, 'state': state, 'labels': labels, 'created_at': created % number}
        return {'issues': [
            issue(1, 'Dedup review: ' + A, ['dedup-escalate', 'pattern:other']),
            issue(2, 'Dedup review: ' + B, [{'name': 'dedup-escalate'}]),   # a label given as an object
            issue(3, 'Dedup review: ' + C, ['bug']),                          # a look-alike without the label
            issue(4, 'Dedup review: ' + C + ' (urgent)', ['dedup-escalate']),  # label, but not the exact title
            issue(5, 'Dedup review: ' + A, ['dedup-escalate'], state='CLOSED'),
            issue(6, 'Dedup review: ' + 'ABCDEF01-0000-4000-8000-000000000000', ['dedup-escalate']),  # upper-case hex
        ], 'pageInfo': {}}

    def test_only_labelled_exact_titles_count(self):
        path = self.write(json.dumps(self.listing()), 'issues.json')
        code, out, _ = self.run_cli('issue-ids', path, '--state', 'OPEN')
        result = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(result['ids'], [A, B])
        self.assertEqual(result['ignored'], 4)  # no label, not the exact title, closed, upper-case
        self.assertEqual(result['oldestCreatedAt'], '2026-11-01T00:00:00Z')
        _, out, _ = self.run_cli('issue-ids', path)
        self.assertEqual(json.loads(out)['ids'], [A, B])  # the closed duplicate of A adds no second id

    def test_cap_keeps_the_oldest_and_pages_merge(self):
        second = self.write(json.dumps({'issues': [{'number': 9, 'title': 'Dedup review: ' + C, 'state': 'OPEN', 'labels': ['dedup-escalate'], 'created_at': '2026-11-09T00:00:00Z'}]}), 'p2.json')
        first = self.write(json.dumps(self.listing()), 'p1.json')
        _, out, _ = self.run_cli('issue-ids', first, second, '--state', 'OPEN', '--max', '1')
        result = json.loads(out)
        self.assertEqual(result['ids'], [A])
        self.assertTrue(result['capped'])
        self.assertEqual(result['count'], 3)  # A, B and C from the second page

    def test_bad_input(self):
        self.assertEqual(self.run_cli('issue-ids', self.write('nope', 'x.json'))[0], dr.EXIT_BAD_INPUT)
        self.assertEqual(self.run_cli('issue-ids', self.write('{"a":1}', 'y.json'))[0], dr.EXIT_BAD_INPUT)


if __name__ == '__main__':
    unittest.main()
