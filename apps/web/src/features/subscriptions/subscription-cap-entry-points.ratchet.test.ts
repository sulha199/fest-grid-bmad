import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Story 10.3a (show the subscription cap refusal and the upgrade call to action) ratchet, a regex scan of the non-test
// source under apps/web/src (not a full guarantee):
//
//  1. Every entry point that can raise SUBSCRIPTION_CAP_REACHED -- a file that uses `useSubscribeToAccountMutation`, or
//     the subscription RESTORE (`useRemoveSubscriptionMutation` with a restore action), or that starts a Retry -- handles
//     it through the one reader/hook. The allowlist below can only shrink, and every entry says why.
//  2. Votes are never blocked (PRD Section 6): no vote, vote-suggestion or account-vote file imports the cap handling.
//
// The moderator exemption is server-side and proven by Story 10.3's real-Postgres tests; there is no client role check
// to scan for (a client branch on role would be dead code that can only hide a server bug).

const SRC_ROOT = join(__dirname, '..', '..');
const SKIPPED_DIRS = new Set(['generated', 'node_modules']);
const CAP_HANDLING = /\b(readSubscriptionCapRefusal|useSubscriptionCapRefusal|useRestoreCapRefusal|SubscriptionCapNoticeConnected|SubscriptionCapDialog)\b|subscriptions\/(subscription-cap-error|use-subscription-cap-refusal|use-restore-cap-refusal|SubscriptionCapNoticeConnected|SubscriptionCapDialog)/;
const SUBSCRIBE_MUTATION = /\buseSubscribeToAccountMutation\b/;
const REMOVE_MUTATION = /\buseRemoveSubscriptionMutation\b/;
const RESTORE_ACTION = /SoftDeleteAction\.Restore|['"]RESTORE['"]/;

/** Files allowed to use a cap-raising mutation without the cap handling. Reasoned; can only shrink. */
const ALLOWLIST: Record<string, string> = {};

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIPPED_DIRS.has(entry)) collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = collectSourceFiles(SRC_ROOT).map((full) => ({ rel: relative(SRC_ROOT, full).split(sep).join('/'), src: readFileSync(full, 'utf8') }));

/** Pure so the test can prove the scan catches what it guards against. */
function raisesCapRefusal(src: string): boolean {
  return SUBSCRIBE_MUTATION.test(src) || (REMOVE_MUTATION.test(src) && RESTORE_ACTION.test(src));
}

describe('subscription cap entry points ratchet (Story 10.3a)', () => {
  it('every file that can raise the cap refusal handles it through the one reader or hook', () => {
    const offenders = files
      // The generated hooks and the cap feature folder itself are not entry points.
      .filter(({ rel }) => !rel.startsWith('features/subscriptions/'))
      .filter(({ src }) => raisesCapRefusal(src))
      .filter(({ rel, src }) => !CAP_HANDLING.test(src) && !(rel in ALLOWLIST))
      .map(({ rel }) => rel);
    expect(offenders, `these files can raise SUBSCRIPTION_CAP_REACHED but do not use readSubscriptionCapRefusal / useSubscriptionCapRefusal:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('finds the entry points it is meant to guard (so an empty scan cannot pass)', () => {
    const entryPoints = files.filter(({ src }) => raisesCapRefusal(src)).map(({ rel }) => rel);
    for (const expected of [
      'app/[locale]/settings/account/subscribe-account-dialog.tsx',
      'app/[locale]/settings/account/subscriptions-content.tsx',
      'app/[locale]/posts/select/posts-select-content.tsx',
      'features/onboarding/onboarding-subscribe-step.tsx',
      'features/events/EventDetailWrapper.tsx',
    ]) {
      expect(entryPoints).toContain(expected);
    }
  });

  it('the Retry notice (Story 10.4 slot) renders the real cap notice', () => {
    const notice = files.find(({ rel }) => rel === 'features/jobs/job-retry-failure-notice.tsx');
    expect(notice?.src).toMatch(CAP_HANDLING);
  });

  it('the allowlist stays empty or reasoned (every key is a real file)', () => {
    for (const key of Object.keys(ALLOWLIST)) {
      expect(files.some(({ rel }) => rel === key), `${key} no longer exists: drop it from the allowlist`).toBe(true);
      expect(ALLOWLIST[key]!.length).toBeGreaterThan(10);
    }
  });

  it('votes are never blocked: no vote, vote-suggestion or account-vote file imports the cap handling', () => {
    // `useVotedAccountSuggestionsQuery` is deliberately not here: the Subscribe dialog READS voted-account suggestions to
    // pre-fill a handle, and it is a subscribe entry point, not vote code. Casting or withdrawing a vote is.
    const VOTE_HOOKS = /\b(useCastVoteMutation|useWithdrawVoteMutation|useRankedVoteAccountsQuery|useVoteRegionBreakdownQuery)\b/;
    const voteFiles = files.filter(({ rel, src }) => /(^|\/)votes?(\/|\.|-)/i.test(rel) || /votes\.graphql/.test(rel) || VOTE_HOOKS.test(src));
    expect(voteFiles.length).toBeGreaterThan(0);
    const offenders = voteFiles.filter(({ src }) => CAP_HANDLING.test(src)).map(({ rel }) => rel);
    expect(offenders, `vote code must never handle the subscription cap (votes are never blocked):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the scan catches the regression it guards against', () => {
    expect(raisesCapRefusal('const m = useSubscribeToAccountMutation(client)')).toBe(true);
    expect(raisesCapRefusal('useRemoveSubscriptionMutation(c); removeSubscription({ action: SoftDeleteAction.Restore })')).toBe(true);
    expect(raisesCapRefusal('useRemoveSubscriptionMutation(c); removeSubscription({ action: SoftDeleteAction.Delete })')).toBe(false);
    expect(CAP_HANDLING.test("import { readSubscriptionCapRefusal } from '@/features/subscriptions/subscription-cap-error'")).toBe(true);
  });
});
