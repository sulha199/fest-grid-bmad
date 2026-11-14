import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Story 10.13 (AC5; Architecture Spine AD-53) -- `announceEndedJobs` is the ONLY file in the job engine that sends a push or the moderator
// mail. A regex scan of the non-test `.ts` files in this directory (the style of suggested-match-resolve-ratchet.test.ts): it does not
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

function productionFiles(dir: string): Array<{ name: string; text: string }> {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
}

function offenders(files: Array<{ name: string; text: string }>): string[] {
  return files
    .filter(({ name }) => name !== ANNOUNCER)
    .filter(({ text }) =>
      text
        .split('\n')
        .filter((line) => /^\s*import\b/.test(line))
        .some((line) => SENDER_IMPORT.test(line))
    )
    .map(({ name }) => name);
}

test('only announce-ended-jobs.ts imports a push or moderator-mail sender in the job engine', () => {
  assert.deepEqual(offenders(productionFiles(DIR)), []);
});

test('the announcer itself does import the senders (the scan is looking at the right file)', () => {
  const announcer = productionFiles(DIR).find((file) => file.name === ANNOUNCER);
  assert.ok(announcer);
  assert.ok(announcer.text.split('\n').some((line) => /^\s*import\b/.test(line) && SENDER_IMPORT.test(line)));
});

test('the scan is red against a synthetic offender', () => {
  const synthetic = { name: 'rogue.ts', text: "import { getMessagingClient } from '../notifications/send-event-notifications.js';\n" };
  assert.deepEqual(offenders([...productionFiles(DIR), synthetic]), ['rogue.ts']);
  const mail = { name: 'rogue2.ts', text: "import { notifyAllModerators } from '../notifications/notify-all-moderators.js';\n" };
  assert.deepEqual(offenders([mail]), ['rogue2.ts']);
});

test('every file that writes finishedAt is listed with the reason the announcer covers it', () => {
  const writers = productionFiles(DIR)
    .filter(({ text }) => /\bfinishedAt\s*:/.test(text))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(writers, Object.keys(FINISHED_AT_WRITERS).sort(), 'a new file that sets finishedAt must be added to FINISHED_AT_WRITERS with its reason');
});
