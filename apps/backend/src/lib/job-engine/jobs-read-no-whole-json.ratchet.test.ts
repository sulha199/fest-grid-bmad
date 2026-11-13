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
