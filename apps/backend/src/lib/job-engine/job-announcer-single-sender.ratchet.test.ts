import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Story 10.13 (AC5; Architecture Spine AD-53) -- `announceEndedJobs` is the ONLY file in the job engine that sends a push or the moderator
// mail. A regex scan of the whole text (comments removed) of the non-test `.ts` files in this directory and its subfolders (the style of suggested-match-resolve-ratchet.test.ts): it does not
// follow an import through another module, so a reviewer also reads any new import of the notifications modules.

const DIR = path.join(process.cwd(), 'src/lib/job-engine');
const ANNOUNCER = 'announce-ended-jobs.ts';
const SENDER_IMPORT = /\b(firebase-admin|getMessagingClient|fcm-tokens|notify-all-moderators|sendTemplatedEmail|send-event-notifications)\b/;

/** Files that write `finishedAt`, each with why the announcer's row-state read covers it (a new ending path must be added here consciously). */
const FINISHED_AT_WRITERS: Record<string, string> = {
  'cancel-job.ts': 'the owner cancel sets owner_notified_at itself; a cancel by replacement is read by the announcer',
  'job-host.ts': 'markJobStartFailed ends the job FAILED; the announcer reads the row',
  'late-results.ts': 'a settled late result and endWaitingJob; a revival clears owner_notified_at so the announcer tells the owner again',
  'run-job.ts': 'the run own ending; the announcer reads the row',
  'settle-followers.ts': 'a follower copies its leader ending (and clears owner_notified_at); the announcer reads the follower row',
  'sweep-expired-jobs.ts': 'the overdue-job expiry; the announcer reads the row',
  'sweep-job-queue.ts': 'the queue-wait expiry; the announcer reads the row',
  [ANNOUNCER]: 'it only selects finishedAt (a read), never writes it',
  'job-read-mappers.ts': 'the Jobs read mapper copies finishedAt (a read)',
};

/** Every non-test `.ts` file under the directory, subfolders included. */
function productionFiles(dir: string, prefix = ''): Array<{ name: string; text: string }> {
  const found: Array<{ name: string; text: string }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) found.push(...productionFiles(path.join(dir, entry.name), `${rel}/`));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) found.push({ name: rel, text: fs.readFileSync(path.join(dir, entry.name), 'utf8') });
  }
  return found;
}

/** Comments removed, so a sentence that names a module is not a use of it; everything else (any import form, require, a call) is scanned. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function offenders(files: Array<{ name: string; text: string }>): string[] {
  return files.filter(({ name }) => name !== ANNOUNCER).filter(({ text }) => SENDER_IMPORT.test(code(text))).map(({ name }) => name);
}

test('only announce-ended-jobs.ts touches a push or moderator-mail sender in the job engine (any import form, subfolders included)', () => {
  assert.deepEqual(offenders(productionFiles(DIR)), []);
});

test('the announcer itself does use the senders (the scan is looking at the right file)', () => {
  const announcer = productionFiles(DIR).find((file) => file.name === ANNOUNCER);
  assert.ok(announcer);
  assert.ok(SENDER_IMPORT.test(code(announcer.text)));
});

test('the scan is red against synthetic offenders: a plain, a multi-line and a dynamic import, a require and a subfolder file', () => {
  const rogue = (name: string, text: string) => ({ name, text });
  const cases = [
    rogue('plain.ts', "import { getMessagingClient } from '../notifications/send-event-notifications.js';\n"),
    rogue('multi.ts', "import {\n  notifyAllModerators,\n} from\n  '../notifications/notify-all-moderators.js';\n"),
    rogue('dynamic.ts', "const m = await import('../notifications/notify-all-moderators.js');\n"),
    rogue('required.ts', "const { sendTemplatedEmail } = require('../email/send.js');\n"),
    rogue('sub/deep.ts', "import admin from 'firebase-admin';\n"),
  ];
  for (const c of cases) assert.deepEqual(offenders([c]), [c.name], c.name);
  assert.deepEqual(offenders([rogue('doc.ts', "// notify-all-moderators is only used by the announcer\n/* getMessagingClient */\nexport const x = 1;\n")]), [], 'a comment is not a use');
});

test('every file that writes finishedAt is listed with the reason the announcer covers it', () => {
  const writers = productionFiles(DIR)
    .filter(({ text }) => /\bfinishedAt\s*:/.test(text))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(writers, Object.keys(FINISHED_AT_WRITERS).sort(), 'a new file that sets finishedAt must be added to FINISHED_AT_WRITERS with its reason');
});
