import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

// AD-31 Rule 4's "drift guard" (Story 3.18, AC6) -- closes the gap left by Story 3.6v's own AC3,
// which promised this exact ratchet test and marked it `[x]` done, but shipped no such file
// (verified by direct grep against the codebase during this story's creation). Modeled directly
// on `apps/backend/src/schema/events-postid-write-ratchet.test.ts`'s `readdirSync`/`readFileSync`
// source-scan style -- a pragmatic regex scan, not a new scanning framework or a full AST parse.
//
// Check A: fails if any other file re-implements the association join by referencing the raw SQL
// table identifier `post_account_associations` inside a `sql\`...\`` template-literal block.
// Check B: fails if any other file (scoped to the two places AD-31 Rule 4 actually binds --
// `schema/resolvers.ts` and `lib/events/**`) re-implements the bare legacy-style join this story
// removed from `resolvers.ts`'s Task 2: `innerJoin(posts, eq(<x>.accountId, posts.accountId))`
// followed, in the same statement, by `eq(posts.id, events.postId)`.

const SRC_ROOT = resolve(process.cwd(), 'src');
const ALLOWED_MODULE = join(SRC_ROOT, 'lib', 'events', 'event-account-match.ts');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === 'generated') continue;
      out.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

// --- Check A: raw `post_account_associations` SQL identifier inside a sql`...` block ---------

// Matches a `sql` template-literal block (`sql\`...\`` -- including the tagged-template form
// used throughout this codebase, e.g. `sql\`(\n  EXISTS (...)\n)\``), scoped forward via
// backtick-depth-free scanning: `sql` template literals in this codebase never contain a nested
// backtick, so we scan from the opening backtick to the next backtick.
const SQL_TEMPLATE_PATTERN = /\bsql`/g;
// Inside a sql`` block, flag `post_account_associations` only when preceded (within the same
// block, looking backward a bounded window) by `FROM`/`JOIN` on the same statement -- i.e. it is
// being used as a raw SQL table identifier, not merely mentioned in prose. This excludes the
// camelCase Drizzle import `postAccountAssociations` (different token entirely -- no underscore)
// and excludes any mention inside a `//` or `/* */` comment (comments are stripped before this
// check runs, see `stripComments` below).
const RAW_TABLE_REF_PATTERN = /\b(FROM|JOIN)\s+post_account_associations\b/i;

/** Strips line comments and block comments from TS source, naively (no string-aware parsing) --
 * adequate for this scan's purpose since the codebase doesn't embed comment-start sequences
 * inside string literals in a way that would create a false negative for the patterns above. */
function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function findRawAssociationTableRefs(filePath: string): boolean {
  const raw = readFileSync(filePath, 'utf8');
  const content = stripComments(raw);
  let match: RegExpExecArray | null;
  SQL_TEMPLATE_PATTERN.lastIndex = 0;
  while ((match = SQL_TEMPLATE_PATTERN.exec(content)) !== null) {
    const closingBacktick = content.indexOf('`', match.index + match[0].length);
    const block = closingBacktick === -1
      ? content.slice(match.index + match[0].length)
      : content.slice(match.index + match[0].length, closingBacktick);
    if (RAW_TABLE_REF_PATTERN.test(block)) {
      return true;
    }
  }
  return false;
}

// --- Check B: bare legacy-style join (innerJoin(posts, ...accountId = posts.accountId...)) ----

const LEGACY_JOIN_SCOPE = [
  join(SRC_ROOT, 'schema', 'resolvers.ts'),
  join(SRC_ROOT, 'lib', 'events'),
];

// The exact regression shape Task 2 removed from `resolvers.ts`: an `innerJoin` against `posts`
// matching some table's `accountId` to `posts.accountId`, in the same statement as a comparison
// of `posts.id` to `events.postId`. Scoped forward via bracket-depth tracking to one statement,
// the same technique `events-postid-write-ratchet.test.ts` already uses.
const INNER_JOIN_POSTS_PATTERN = /\.innerJoin\(\s*posts\s*,\s*eq\(\s*[\w.]+\.accountId\s*,\s*posts\.accountId\s*\)\s*\)/g;
const POSTID_EQ_EVENTS_POSTID_PATTERN = /eq\(\s*posts\.id\s*,\s*events\.postId\s*\)/;

function extractRestOfStatement(content: string, fromIndex: number): string {
  let depth = 0;
  for (let i = fromIndex; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return content.slice(fromIndex, i);
      depth--;
    } else if (ch === ';' && depth === 0) {
      return content.slice(fromIndex, i);
    }
  }
  return content.slice(fromIndex);
}

function findLegacyStyleJoins(content: string): boolean {
  let match: RegExpExecArray | null;
  INNER_JOIN_POSTS_PATTERN.lastIndex = 0;
  while ((match = INNER_JOIN_POSTS_PATTERN.exec(content)) !== null) {
    const tail = extractRestOfStatement(content, match.index + match[0].length);
    if (POSTID_EQ_EVENTS_POSTID_PATTERN.test(tail)) {
      return true;
    }
  }
  return false;
}

function isWithinScope(filePath: string): boolean {
  return LEGACY_JOIN_SCOPE.some((scopedPath) => {
    if (scopedPath.endsWith('.ts')) return resolve(filePath) === resolve(scopedPath);
    return resolve(filePath).startsWith(resolve(scopedPath) + sep);
  });
}

test('Check A: no file other than event-account-match.ts raw-SQL-references post_account_associations', () => {
  const files = collectTsFiles(SRC_ROOT).filter((f) => resolve(f) !== resolve(ALLOWED_MODULE));

  const offenders = files.filter(findRawAssociationTableRefs).map((f) => relative(SRC_ROOT, f).split(sep).join('/'));

  assert.deepStrictEqual(
    offenders,
    [],
    `Found raw SQL reference(s) to post_account_associations outside the AD-31 Rule 4 helper module (lib/events/event-account-match.ts): ${offenders.join(', ')}`
  );
});

test('Check A is not a false positive against files that only mention the string in comments/camelCase imports', () => {
  // persist-post-account-associations.ts and resolve-post-publisher-opt-in.ts both mention
  // `post_account_associations` only inside doc comments and via the camelCase Drizzle import
  // `postAccountAssociations` -- neither should be flagged.
  const persistFile = join(SRC_ROOT, 'lib', 'posts', 'persist-post-account-associations.ts');
  const resolveOptInFile = join(SRC_ROOT, 'lib', 'posts', 'resolve-post-publisher-opt-in.ts');
  assert.strictEqual(findRawAssociationTableRefs(persistFile), false, 'persist-post-account-associations.ts should not be flagged (comment-only mention)');
  assert.strictEqual(findRawAssociationTableRefs(resolveOptInFile), false, 'resolve-post-publisher-opt-in.ts should not be flagged (comment-only mention)');
});

test('Check B: no legacy-style bare posts.accountId/events.postId join outside the helper, in resolvers.ts or lib/events/**', () => {
  const files = collectTsFiles(SRC_ROOT)
    .filter((f) => resolve(f) !== resolve(ALLOWED_MODULE))
    .filter(isWithinScope);

  const offenders = files
    .filter((f) => findLegacyStyleJoins(readFileSync(f, 'utf8')))
    .map((f) => relative(SRC_ROOT, f).split(sep).join('/'));

  assert.deepStrictEqual(
    offenders,
    [],
    `Found legacy-style posts.accountId/events.postId join(s) outside the AD-31 Rule 4 helper module: ${offenders.join(', ')}`
  );
});

test('the scan is actually tuned correctly (not vacuously passing against the real pre-fix codebase)', () => {
  // Negative control (Task 3's "non-vacuous" proof): the exact pre-Task-2 shape of
  // `event`/`eventBySlug`'s `personalConnectionCheck` in resolvers.ts, verified against this
  // story's baseline_commit (19a4e2ad237b60e2897cfafdf1998b130424febd) via
  // `git show <baseline_commit>:apps/backend/src/schema/resolvers.ts` -- reproduced verbatim here
  // (not a loosely-inspired fixture) so this test proves Check B's regex is actually tuned to the
  // real offending call, not just a convenient synthetic shape.
  const preFixSnippet = `
          exists(
            db.select({ id: subscriptions.id })
              .from(subscriptions)
              .innerJoin(posts, eq(subscriptions.accountId, posts.accountId))
              .where(and(
                eq(posts.id, events.postId),
                eq(subscriptions.userId, userId),
                activeOnly(subscriptions)
              ))
          ),
  `;
  assert.strictEqual(findLegacyStyleJoins(preFixSnippet), true, 'Expected Check B to flag the real pre-fix personalConnectionCheck join');

  // Positive confirmation that the post-fix call site no longer matches at all: it now goes
  // through the helper instead of a bare innerJoin on posts.
  const postFixSnippet = `
          exists(
            db.select({ id: subscriptions.id })
              .from(subscriptions)
              .where(and(
                eq(subscriptions.userId, userId),
                activeOnly(subscriptions),
                buildEventAccountMatchCondition(subscriptions.accountId)
              ))
          ),
  `;
  assert.strictEqual(findLegacyStyleJoins(postFixSnippet), false, 'Expected Check B to find no legacy join in the post-fix call site');

  // Negative control for Check A: a hypothetical re-implementation that raw-SQL-joins
  // post_account_associations outside the helper would be caught.
  const rawSqlReimplementation = 'sql`EXISTS (SELECT 1 FROM post_account_associations paa WHERE paa.post_id = ${postId})`';
  assert.strictEqual(findRawAssociationTableRefs.name, 'findRawAssociationTableRefs');
  SQL_TEMPLATE_PATTERN.lastIndex = 0;
  const sqlMatch = SQL_TEMPLATE_PATTERN.exec(rawSqlReimplementation);
  assert.ok(sqlMatch, 'Expected the sql-template pattern to match the hypothetical re-implementation');
  const closing = rawSqlReimplementation.indexOf('`', sqlMatch!.index + sqlMatch![0].length);
  const block = rawSqlReimplementation.slice(sqlMatch!.index + sqlMatch![0].length, closing);
  assert.ok(RAW_TABLE_REF_PATTERN.test(block), 'Expected Check A to flag the hypothetical raw-SQL re-implementation');
});
