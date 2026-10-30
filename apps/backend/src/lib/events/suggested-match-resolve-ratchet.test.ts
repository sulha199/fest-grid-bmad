import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

// AD-30 Rule 9 drift guard. A pending `event_match_candidates` suggestion is resolved in exactly two
// places: `merge-events.ts` (the ACCEPT flip inside `mergeEvents()`, and the undo back to pending) and
// `resolve-suggested-match.ts` (the REJECT, and the row lock plus pending check in front of both).
// `Mutation.resolveSuggestedEventMatch` must go through `resolveSuggestedMatch()`, never re-implement
// the accept/reject path, so the moderator UI and any other caller cannot drift apart.
//
// A pragmatic regex scan in the style of `schema/events-postid-write-ratchet.test.ts`, not an AST
// parse. Comments are stripped first (several files mention the table name in prose).

const SRC_ROOT = resolve(process.cwd(), 'src');
const ALLOWED_WRITERS = [join(SRC_ROOT, 'lib', 'events', 'merge-events.ts'), join(SRC_ROOT, 'lib', 'events', 'resolve-suggested-match.ts')];
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

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** The identifiers `eventMatchCandidates` is bound to in a file: itself plus any `import { x as y }` alias. */
function tableNames(source: string): string[] {
  const names = ['eventMatchCandidates'];
  for (const m of source.matchAll(/\beventMatchCandidates\s+as\s+(\w+)/g)) names.push(m[1]);
  return names;
}

/** True when the source updates `event_match_candidates`, through drizzle (also via an import alias) or raw SQL. */
function writesSuggestionStatus(rawSource: string): boolean {
  const source = stripComments(rawSource);
  const drizzleUpdate = new RegExp(`\\.update\\(\\s*(?:${tableNames(source).join('|')})\\s*\\)`);
  const rawSqlUpdate = /\bupdate\s+(?:"?\w+"?\.)?"?event_match_candidates"?/i;
  return drizzleUpdate.test(source) || rawSqlUpdate.test(source);
}

const toRelative = (file: string) => relative(SRC_ROOT, file).split(sep).join('/');

test('only merge-events.ts and resolve-suggested-match.ts update event_match_candidates', () => {
  const files = collectTsFiles(SRC_ROOT).filter((f) => !ALLOWED_WRITERS.includes(resolve(f)));

  const offenders = files.filter((f) => writesSuggestionStatus(readFileSync(f, 'utf8'))).map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found event_match_candidates update(s) outside lib/events/merge-events.ts and lib/events/resolve-suggested-match.ts (AD-30 Rule 9): ${offenders.join(', ')}. Resolve a suggestion through resolveSuggestedMatch().`
  );
});

test('the resolver resolves a suggestion through resolveSuggestedMatch() and does not merge inline', () => {
  const source = stripComments(readFileSync(RESOLVERS_FILE, 'utf8'));

  assert.ok(/\bresolveSuggestedMatch\(/.test(source), 'resolvers.ts must call resolveSuggestedMatch(); an import alone does not count');
  assert.ok(!/\bmergeEvents\(/.test(source), 'resolvers.ts must not call mergeEvents() directly; accept goes through resolveSuggestedMatch()');
});

test('the write detector flags every way of updating the table, and nothing else (negative controls)', () => {
  assert.ok(writesSuggestionStatus(`await tx.update(eventMatchCandidates).set({ status: 'rejected' }).where(x);`), 'direct drizzle update');
  assert.ok(writesSuggestionStatus(`await db\n  .update( eventMatchCandidates )\n  .set({});`), 'update split across lines');
  assert.ok(
    writesSuggestionStatus(`import { eventMatchCandidates as suggestions } from '@festgrid/database';\nawait tx.update(suggestions).set({});`),
    'aliased import'
  );
  assert.ok(writesSuggestionStatus('await tx.execute(sql`UPDATE event_match_candidates SET status = \'accepted\'`);'), 'raw SQL');
  assert.ok(writesSuggestionStatus('await tx.execute(sql`update "public"."event_match_candidates" set status = 1`);'), 'quoted, schema-qualified raw SQL');

  assert.ok(!writesSuggestionStatus(`await tx.insert(eventMatchCandidates).values(row).onConflictDoNothing();`), 'ingestion inserts a suggestion; that is not a status write');
  assert.ok(!writesSuggestionStatus(`const rows = await db.select().from(eventMatchCandidates);`), 'a read');
  assert.ok(!writesSuggestionStatus(`await tx.update(events).set({});`), 'another table');
  assert.ok(!writesSuggestionStatus(`// we update event_match_candidates elsewhere\n/* tx.update(eventMatchCandidates) */\nconst x = 1;`), 'comments');
});
