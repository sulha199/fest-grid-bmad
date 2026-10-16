/**
 * BUG-059 -- one-off tool: finds "twin" profile rows (same platform + username, more than one row) and
 * merges each twin into its survivor.
 *
 *   npx tsx scripts/merge-twin-profiles.ts            dry run: prints the plan, changes nothing
 *   npx tsx scripts/merge-twin-profiles.ts --apply    merges every group that is safe to auto-merge
 *   npx tsx scripts/merge-twin-profiles.ts --apply --allow-without-evidence=a,b
 *                                                      also merges the named usernames although the
 *                                                      vendor evidence is missing (a human confirmed them);
 *                                                      blockers still apply
 *
 * A group is merged only when the vendor itself proved the identity (a post published by the twin and
 * scraped under the survivor, with a matching owner username) and no blocker applies. Anything else is
 * reported and left alone. Groups of more than two rows are never merged automatically.
 *
 * It runs against whatever DATABASE_URL points at. Applying to production needs a writer connection;
 * take a backup of the affected rows first (spec-profile-identity-unification section 6).
 */
import { findTwinGroups, planAccountProfileMerge, mergeAccountProfiles } from '../src/lib/accounts/merge-account-profiles.js';

async function main() {
  const apply = process.argv.includes('--apply');
  const overrideArg = process.argv.find((arg) => arg.startsWith('--allow-without-evidence='));
  const allowWithoutEvidence = new Set(
    (overrideArg?.split('=')[1] ?? '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
  );
  const performedBy = 'script:merge-twin-profiles';

  const groups = await findTwinGroups();
  if (groups.length === 0) {
    console.log('No twin groups found.');
    return;
  }

  console.log(`${groups.length} twin group(s) found. Mode: ${apply ? 'APPLY' : 'dry run (pass --apply to merge)'}\n`);
  let merged = 0;
  let skipped = 0;

  for (const group of groups) {
    const label = `${group.platform}/${group.username}`;
    if (group.profiles.length !== 2) {
      console.log(`SKIP  ${label}: ${group.profiles.length} rows in the group (only pairs are merged automatically)`);
      skipped++;
      continue;
    }

    const [survivor, twin] = group.profiles;
    const plan = await planAccountProfileMerge(survivor.id, twin.id);
    const summary =
      `survivor ${survivor.account_id} (${survivor.id}, ${survivor.active_subscriptions} subs, ${survivor.post_count} posts)` +
      ` <- twin ${twin.account_id} (${twin.id}, ${twin.post_count} posts); evidence posts: ${plan.evidenceCount}`;

    const overridden = plan.blockers.length === 0 && plan.evidenceCount === 0 && allowWithoutEvidence.has(group.username);
    if (!plan.safeToAutoMerge && !overridden) {
      const reasons = plan.blockers.length > 0 ? plan.blockers.join('; ') : 'no vendor-proven evidence';
      console.log(`SKIP  ${label}: ${summary}\n      reason: ${reasons}`);
      skipped++;
      continue;
    }

    if (!apply) {
      console.log(`PLAN  ${label}: ${summary}${overridden ? ' [override: merged without vendor evidence]' : ''}`);
      continue;
    }

    const result = await mergeAccountProfiles({
      survivorId: survivor.id,
      twinId: twin.id,
      performedBy,
      allowWithoutEvidence: overridden,
    });
    const counts = Object.fromEntries(
      Object.entries(result.repointed).map(([key, value]) => [key, Array.isArray(value) ? value.length : value])
    );
    console.log(`MERGED ${label}: ${summary}\n      audit row ${result.mergeId}: ${JSON.stringify(counts)}`);
    merged++;
  }

  console.log(`\nDone. merged=${merged} skipped=${skipped}${apply ? '' : ' (dry run, nothing changed)'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
