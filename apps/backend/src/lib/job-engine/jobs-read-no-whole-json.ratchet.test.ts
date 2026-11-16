import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Story 10.4 (AC5) -- the Jobs read layer takes `jobs.input` and `jobs.result_data` only through named JSON paths (a held caption lives in
// `input.held`, the re-extract preview in `result_data`), and `jobs.error_message` only for a moderator. A source scan, like the other
// ratchets: the two columns may be named only on the lines that build the path helpers, and `errorMessage` only on its one moderator line.
// It cannot see a whole column read through another module: a reviewer reads any new import of `jobs` into these two files.

const files = ['read-jobs.ts', 'retry-job.ts', 'job-read-mappers.ts'].map((f) => ({ name: f, text: fs.readFileSync(path.join(process.cwd(), 'src/lib/job-engine', f), 'utf8') }));

test('read-jobs.ts, retry-job.ts and job-read-mappers.ts never select input, result_data or error_message whole', () => {
  for (const { name, text } of files) {
    const code = text.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'));
    for (const line of code) {
      if (/jobs\.(input|resultData)\b/.test(line)) {
        assert.match(line, /^const (inputJson|resultJson) = sql`\(\$\{jobs\.(input|resultData)\} #>> '\{\}'\)::jsonb`;$/, `${name}: a whole-column read of input/result_data: ${line.trim()}`);
      }
      if (/jobs\.errorMessage\b/.test(line)) {
        assert.match(line, /select\.errorMessage = jobs\.errorMessage;/, `${name}: error_message outside the moderator branch: ${line.trim()}`);
      }
    }
    assert.ok(!/\bselect\(\)\s*\.from\(jobs\)/.test(text), `${name}: db.select() with no column list on jobs would read every column`);
  }
});

// Story 10.6a (AC2) -- `Job.refresh` reads `result_data` through these named paths and no other, only for a moderator who selected `refresh`,
// and the mapper copies `images` field by field. The set of paths is pinned so a new one is a deliberate edit of this list.
test('every use of the result_data helper is a named path, and the refresh paths are the pinned set behind the moderator and selection guard', () => {
  for (const { name, text } of files) {
    const code = text.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'));
    for (const line of code) {
      for (const match of line.matchAll(/\$\{(resultJson|inputJson)\}(.{0,12})/g)) {
        assert.match(match[2], /^( #>> '\{|  ?#> '\{| ->> '| -> '|\) )/, `${name}: ${match[1]} used without a named path: ${line.trim()}`);
      }
    }
  }
  const read = files.find((f) => f.name === 'read-jobs.ts')!.text;
  const start = read.indexOf("if (viewer.role === 'moderator' && wants('refresh')) {");
  assert.ok(start > 0, 'the refresh block is guarded by the moderator check and the selection');
  const block = read.slice(start, read.indexOf('\n  }\n', start));
  const paths = [...block.matchAll(/\$\{resultJson\} (#>>?) '(\{[^']*\})'/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(paths, [
    "#>> {refresh,outcome}",
    "#>> {refresh,saved}",
    "#>> {refresh,lateResultPending}",
    "#>> {refresh,retryAfter}",
    "#>> {refresh,expiredLinks}",
    "#>> {imagesAvailable}",
    "#>> {imagesSent}",
    "#>> {imageCap}",
    "#> {images}",
  ]);
  const mappers = files.find((f) => f.name === 'job-read-mappers.ts')!.text;
  assert.ok(/export function mapRefreshImages/.test(mappers) && /const \{ position, role, state \} = entry/.test(mappers), 'images are copied field by field');
  assert.ok(!/\.\.\.entry\b|\.\.\.row\b/.test(mappers.slice(mappers.indexOf('export function mapRefreshImages'), mappers.indexOf('function mapSubject'))), 'no spread of a stored entry into the response');
});
