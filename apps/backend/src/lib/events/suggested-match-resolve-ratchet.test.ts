import test from 'node:test';
import * as assert from 'node:assert';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

// AD-30 Rule 9 drift guard. A moderator's accept or reject of a pending `event_match_candidates`
// suggestion is written in exactly two places: `merge-events.ts` (the ACCEPT flip inside
// `mergeEvents()`, and the undo back to pending) and `resolve-suggested-match.ts` (the REJECT, and the
// row lock plus pending check in front of both). `Mutation.resolveSuggestedEventMatch` must go through
// `resolveSuggestedMatch()`, never re-implement the accept/reject path, so the moderator UI and any
// other caller of the function cannot drift apart.
//
// One third writer is allowed: `expire-match-suggestions.ts` (IDEA-107) closes a pending suggestion
// nobody can act on as `expired`. That is not an accept or a reject, and it is safe beside the row
// lock only because its single UPDATE carries its own `status = 'pending'` guard, which the last test
// below pins.
//
// What this does NOT catch, on purpose: another file calling `mergeEvents(..., suggestionId)`. The
// backlog drain (`drain-match-backlog.ts`) does exactly that today, without the row lock or a pending
// guard; routing it through `resolveSuggestedMatch()` is a known, deferred gap (BUG-094).
//
// A pragmatic regex scan in the style of `schema/events-postid-write-ratchet.test.ts`, not an AST
// parse. Every writer of the table lives under `apps/backend/src` (checked 2026-10-30); only non-test
// `.ts` files there are scanned (tests seed rows directly), and it must run with `apps/backend` as the
// working directory. Comments are stripped first, string-aware so a glob such as '**/*.ts' cannot
// swallow real code. Known limits: a regex literal containing `//` or a quote can hide the rest of its
// line, a log string that spells out `update event_match_candidates` is flagged, and a table reached
// through a function parameter or a re-export under another name is not followed. Reaching for one of
// those to write the table is the drift this test exists to stop, so review any change that does.

const SRC_ROOT = resolve(process.cwd(), 'src');
const EXPIRY_WRITER = join(SRC_ROOT, 'lib', 'events', 'expire-match-suggestions.ts');
const ALLOWED_WRITERS = [join(SRC_ROOT, 'lib', 'events', 'merge-events.ts'), join(SRC_ROOT, 'lib', 'events', 'resolve-suggested-match.ts'), EXPIRY_WRITER];
const RESOLVERS_FILE = join(SRC_ROOT, 'schema', 'resolvers.ts');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry === 'generated') continue;
      out.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

/**
 * Removes `//` and block comments but keeps the contents of string and template literals, so a
 * `/*` inside a quoted glob is not read as a comment start. A single- or double-quoted string ends at
 * a newline, which limits the damage when a regex literal holds a lone quote.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < n && source[i] !== c && (c === '`' || source[i] !== '\n')) {
        if (source[i] === '\\' && i + 1 < n) out += source[i++];
        out += source[i++];
      }
      if (i < n && source[i] === c) out += source[i++];
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The identifiers `eventMatchCandidates` is bound to in a file: itself plus any import or destructuring alias. */
function tableNames(source: string): string[] {
  const names = ['eventMatchCandidates'];
  for (const m of source.matchAll(/\beventMatchCandidates\s+as\s+(\w+)/g)) names.push(m[1]);
  for (const m of source.matchAll(/\beventMatchCandidates\s*:\s*(\w+)/g)) names.push(m[1]);
  for (const m of source.matchAll(/\b(\w+)\s*=\s*(?:[\w$]+\.)*eventMatchCandidates\b/g)) names.push(m[1]);
  return names;
}

/**
 * True when the source updates `event_match_candidates`: a drizzle update or upsert (through an
 * alias, an assignment, a namespace import or bracket access), or raw SQL (`UPDATE [ONLY]`,
 * an interpolated table, `INSERT ... DO UPDATE`, `MERGE INTO`).
 */
function writesSuggestionStatus(rawSource: string): boolean {
  const source = stripComments(rawSource);
  const table = `(?:(?:[\\w$]+\\.)*(?:${tableNames(source).join('|')})|[\\w$]+\\[\\s*['"]eventMatchCandidates['"]\\s*\\])`;
  const drizzleUpdate = new RegExp(`\\.update\\(\\s*${table}\\s*\\)`);
  const drizzleUpsert = new RegExp(`\\.insert\\(\\s*${table}\\s*\\)[^;]*?\\.onConflictDoUpdate\\(`);
  const rawInterpolated = new RegExp(`\\bupdate\\s+(?:only\\s+)?\\$\\{\\s*${table}\\s*\\}`, 'i');
  const rawUpdate = /\bupdate\s+(?:only\s+)?(?:"?\w+"?\.)?"?event_match_candidates"?/i;
  const rawUpsert = /\binsert\s+into\s+(?:"?\w+"?\.)?"?event_match_candidates"?[^;`]*?\bdo\s+update\b/i;
  const rawMerge = /\bmerge\s+into\s+(?:only\s+)?(?:"?\w+"?\.)?"?event_match_candidates"?/i;
  return [drizzleUpdate, drizzleUpsert, rawInterpolated, rawUpdate, rawUpsert, rawMerge].some((pattern) => pattern.test(source));
}

const toRelative = (file: string) => relative(SRC_ROOT, file).split(sep).join('/');

test('only merge-events.ts, resolve-suggested-match.ts and the expiry writer update event_match_candidates', () => {
  for (const writer of ALLOWED_WRITERS) {
    assert.ok(existsSync(writer), `allowed writer ${toRelative(writer)} no longer exists: update ALLOWED_WRITERS, or this ratchet is checking a stale list`);
  }
  const files = collectTsFiles(SRC_ROOT).filter((f) => !ALLOWED_WRITERS.includes(resolve(f)));

  const offenders = files.filter((f) => writesSuggestionStatus(readFileSync(f, 'utf8'))).map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found event_match_candidates update(s) outside lib/events/merge-events.ts, lib/events/resolve-suggested-match.ts and lib/events/expire-match-suggestions.ts (AD-30 Rule 9): ${offenders.join(', ')}. Resolve a suggestion through resolveSuggestedMatch().`
  );
});

// The call must sit inside the `resolveSuggestedEventMatch` resolver, up to the next resolver key, not just anywhere in the file.
const MUTATION_CALLS_SHARED_FN = /resolveSuggestedEventMatch:\s*async(?:(?!\n {4}\w+:\s*async)[\s\S])*?\bresolveSuggestedMatch\(/;

test('the resolver resolves a suggestion through resolveSuggestedMatch() and does not merge inline', () => {
  const source = stripComments(readFileSync(RESOLVERS_FILE, 'utf8'));

  assert.ok(MUTATION_CALLS_SHARED_FN.test(source), 'resolveSuggestedEventMatch must call resolveSuggestedMatch(); an import or a call elsewhere in the file does not count');
  assert.ok(!/\bmergeEvents\b/.test(source), 'resolvers.ts must not reference mergeEvents (not even an aliased import); accept goes through resolveSuggestedMatch()');
});

// `resolved_via` / `performed_via` say whether a person or the AI reviewer decided. Only server code (the apply script)
// may pass `via`; the moderator mutation must leave it at the default, so no GraphQL client can claim `ai_skill`.
const VIA_MARKERS = /\bvia\s*[:,}]|\[\s*['"`]via['"`]\s*\]|\bai_skill\b|\bresolvedVia\b|\bperformedVia\b|\bresolved_via\b|\bperformed_via\b/;

test('the GraphQL resolvers never pass or write the dedup `via` flag', () => {
  const source = stripComments(readFileSync(RESOLVERS_FILE, 'utf8'));

  assert.ok(!VIA_MARKERS.test(source), 'resolvers.ts must not pass via, ai_skill, resolvedVia or performedVia: the flag is set by server-side callers of resolveSuggestedMatch() only');
  assert.ok(VIA_MARKERS.test('resolveSuggestedMatch(tx, { id, action, moderatorId, via: input.via })'), 'a via argument is caught');
  assert.ok(VIA_MARKERS.test("set({ resolvedVia: 'ai_skill' })"), 'a direct write is caught');
  assert.ok(VIA_MARKERS.test('resolveSuggestedMatch(tx, { id, action, moderatorId, via })'), 'the shorthand property is caught');
  assert.ok(VIA_MARKERS.test("resolveSuggestedMatch(tx, { id, action, moderatorId, ['via']: x })"), 'a computed key is caught');
  assert.ok(VIA_MARKERS.test('await tx.execute(sql`update event_merges set performed_via = 1`)'), 'raw SQL naming the column is caught');
  assert.ok(!VIA_MARKERS.test('resolveSuggestedMatch(tx, { id, action, moderatorId: moderator.userId })'), 'the mutation as written passes');
});

test('the expiry writer only closes rows that are still pending', () => {
  const source = stripComments(readFileSync(EXPIRY_WRITER, 'utf8'));

  assert.ok(writesSuggestionStatus(source), 'the expiry writer is expected to update the table; if it stopped, drop it from ALLOWED_WRITERS');
  assert.ok(
    /\.update\(\s*eventMatchCandidates\s*\)[^;]*?eq\(\s*eventMatchCandidates\.status\s*,\s*'pending'\s*\)/.test(source),
    "its UPDATE must keep `eq(eventMatchCandidates.status, 'pending')`: without it an expiry run could overwrite a suggestion a moderator just accepted or rejected"
  );
});

test('the write detector flags every way of updating the table, and nothing else (negative controls)', () => {
  assert.ok(writesSuggestionStatus(`await tx.update(eventMatchCandidates).set({ status: 'rejected' }).where(x);`), 'direct drizzle update');
  assert.ok(writesSuggestionStatus(`await db\n  .update( eventMatchCandidates )\n  .set({});`), 'update split across lines');
  assert.ok(
    writesSuggestionStatus(`import { eventMatchCandidates as suggestions } from '@festgrid/database';\nawait tx.update(suggestions).set({});`),
    'aliased import'
  );
  assert.ok(writesSuggestionStatus(`const { eventMatchCandidates: suggestions } = schema;\nawait tx.update(suggestions).set({});`), 'destructuring alias');
  assert.ok(writesSuggestionStatus(`import * as schema from '@festgrid/database';\nawait tx.update(schema.eventMatchCandidates).set({});`), 'namespace import');
  assert.ok(
    writesSuggestionStatus(`await tx.insert(eventMatchCandidates).values(row).onConflictDoUpdate({ target: x, set: { status: 'accepted' } });`),
    'upsert that overwrites'
  );
  assert.ok(writesSuggestionStatus('await tx.execute(sql`UPDATE event_match_candidates SET status = \'accepted\'`);'), 'raw SQL');
  assert.ok(writesSuggestionStatus('await tx.execute(sql`update "public"."event_match_candidates" set status = 1`);'), 'quoted, schema-qualified raw SQL');
  assert.ok(
    writesSuggestionStatus(`const globs = ['src/**/*.ts'];\nawait tx.update(eventMatchCandidates).set({});\n/* a later comment */`),
    'a quoted glob must not hide a real write behind a fake block comment'
  );
  assert.ok(
    writesSuggestionStatus('const url = "https://example.test/x"; // trailing\nawait tx.update(eventMatchCandidates).set({});'),
    'a URL with // in a string must not hide the next line'
  );

  assert.ok(writesSuggestionStatus(`const t = schema.eventMatchCandidates;\nawait tx.update(t).set({});`), 'assignment alias');
  assert.ok(writesSuggestionStatus(`await tx.update(schema['eventMatchCandidates']).set({});`), 'bracket access');
  assert.ok(writesSuggestionStatus('await tx.execute(sql`UPDATE ONLY event_match_candidates SET status = 1`);'), 'UPDATE ONLY');
  assert.ok(writesSuggestionStatus('await tx.execute(sql`update ${eventMatchCandidates} set status = 1`);'), 'interpolated table in raw SQL');
  assert.ok(
    writesSuggestionStatus('await tx.execute(sql`INSERT INTO event_match_candidates (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET status = 1`);'),
    'raw upsert'
  );
  assert.ok(writesSuggestionStatus('await tx.execute(sql`MERGE INTO event_match_candidates t USING x ON t.id = x.id WHEN MATCHED THEN UPDATE SET status = 1`);'), 'MERGE INTO');
  assert.ok(!writesSuggestionStatus(`await tx.insert(eventMatchCandidates).values(row).onConflictDoNothing();`), 'ingestion inserts a suggestion; that is not a status write');
  assert.ok(!writesSuggestionStatus(`const rows = await db.select().from(eventMatchCandidates);`), 'a read');
  assert.ok(!writesSuggestionStatus(`await tx.update(events).set({});`), 'another table');
  assert.ok(!writesSuggestionStatus(`// we update event_match_candidates elsewhere\n/* tx.update(eventMatchCandidates) */\nconst x = 1;`), 'comments');
  assert.ok(!writesSuggestionStatus(`const label = 'a /* not a comment */ string';\nawait tx.update(events).set({});`), 'a comment-looking string is not code');

  const insideBody = `    resolveSuggestedEventMatch: async () => {\n      await db.transaction((tx) => resolveSuggestedMatch(tx, input));\n    },\n    undoEventMerge: async () => {},`;
  const inlineThenElsewhere = `    resolveSuggestedEventMatch: async () => {\n      inline();\n    },\n    undoEventMerge: async () => {\n      resolveSuggestedMatch(tx, input);\n    },`;
  assert.ok(MUTATION_CALLS_SHARED_FN.test(insideBody), 'the call inside the mutation body is accepted');
  assert.ok(!MUTATION_CALLS_SHARED_FN.test(inlineThenElsewhere), 'a call in a different resolver does not count for the mutation');
});
