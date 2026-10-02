import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

// AD-30 Rule 2's "drift guard" (Story 3.6r, AC3) — a single backend module
// (apps/backend/src/lib/events/set-event-primary-post.ts) owns every write to `events.postId`.
// This source-scan test, in the same `readdirSync`/`readFileSync`-based style precedent as
// `schema-consistency.test.ts`, fails if any OTHER file writes `postId` in an `events` insert or
// update. It is a pragmatic regex scan, not a full AST parse — acceptable given
// `schema-consistency.test.ts`'s own precedent already mixes a real AST parse with plain string
// scanning in the same file.

const SRC_ROOT = resolve(process.cwd(), 'src');
const ALLOWED_MODULE = join(SRC_ROOT, 'lib', 'events', 'set-event-primary-post.ts');

// A `.insert(events)`/`.update(events)` call, scoped forward to the end of its own statement
// (the chained `.values(...)`/`.set(...)`/`.onConflictDoNothing(...)`/`.where(...)`/
// `.returning()` calls that make up one `await tx.insert(events)...;` expression), which
// contains any reference to `postId` -- an object-literal property (`postId: ...`), a member
// access (`events.postId`, as the pre-Task-6 `process-ingestion-job.ts` wrote via
// `.onConflictDoNothing({ target: [events.postId] })` over a `.values(event)` spread whose
// `event` object came from `buildEventInsertValues()`), or a bare identifier. Scoped to the one
// statement (tracked via bracket depth, ending at the first top-level `;`) rather than a fixed
// character window, so an unrelated `postId` reference later in the same function (e.g. a
// subsequent `.select({ postId: events.postId, ... })` projection in a different statement) is
// never mistaken for a write.
const WRITE_CALL_PATTERN = /\.(insert|update)\(\s*events\s*\)/g;
const POST_ID_FIELD_PATTERN = /\bpostId\b/;

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

/** Returns the rest of the current statement starting right after `fromIndex`: scans forward
 * tracking (), [], {} bracket depth and stops at the first top-level `;` (or, defensively, if a
 * closing bracket would take depth negative -- meaning the enclosing block/arrow-function ended
 * without an explicit semicolon in between). */
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

function findOffendingWrites(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf8');
  let match: RegExpExecArray | null;
  WRITE_CALL_PATTERN.lastIndex = 0;
  while ((match = WRITE_CALL_PATTERN.exec(content)) !== null) {
    const statementTail = extractRestOfStatement(content, match.index + match[0].length);
    if (POST_ID_FIELD_PATTERN.test(statementTail)) {
      return true;
    }
  }
  return false;
}

test('only set-event-primary-post.ts writes postId in an events insert/update', () => {
  const files = collectTsFiles(SRC_ROOT).filter((f) => resolve(f) !== resolve(ALLOWED_MODULE));

  const offenders = files.filter(findOffendingWrites).map((f) => relative(SRC_ROOT, f).split(sep).join('/'));

  assert.deepStrictEqual(
    offenders,
    [],
    `Found events.postId write(s) outside the AD-30 Rule 2 helper module (lib/events/set-event-primary-post.ts): ${offenders.join(', ')}`
  );
});

test('the scan is actually tuned correctly (not vacuously passing against the real pre-fix codebase)', () => {
  // Negative control (Task 8.2): the exact pre-Task-6 shape of process-ingestion-job.ts, verified
  // against this story's baseline_commit (92b60879099b98b0f383fa9662106d5ba424ffcf) via
  // `git show <baseline_commit>:apps/backend/src/lib/ingestor/process-ingestion-job.ts` --
  // reproduced verbatim here (not a loosely-inspired fixture) so this test proves the regex is
  // actually tuned to the real offending call, not just a convenient synthetic shape. It wrote
  // `events.postId` via `onConflictDoNothing({ target: [events.postId] })` over a `.values(event)`
  // spread -- no literal `postId:` property at the call site at all, which is exactly why
  // POST_ID_FIELD_PATTERN matches any `postId` reference, not only an object-literal property.
  const preFixSnippet = `
    const insertedEvents = await tx
      .insert(events)
      .values(event)
      .onConflictDoNothing({ target: [events.postId] })
      .returning();
  `;
  WRITE_CALL_PATTERN.lastIndex = 0;
  const match = WRITE_CALL_PATTERN.exec(preFixSnippet);
  assert.ok(match, 'Expected the write-call pattern to match the pre-fix snippet');
  const statementTail = extractRestOfStatement(preFixSnippet, match!.index + match![0].length);
  assert.ok(POST_ID_FIELD_PATTERN.test(statementTail), 'Expected the postId pattern to flag the real pre-fix call site');

  // Positive confirmation that the post-Task-6 call site no longer matches at all: it no longer
  // calls `.insert(events)` directly (routed through insertEventWithPrimaryPost instead).
  const postFixSnippet = `
    const insertedRow = await insertEventWithPrimaryPost(tx, event);
  `;
  WRITE_CALL_PATTERN.lastIndex = 0;
  assert.strictEqual(WRITE_CALL_PATTERN.exec(postFixSnippet), null, 'Expected no write-call match in the post-fix call site');
});
