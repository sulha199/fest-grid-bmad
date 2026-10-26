/**
 * BUG-081 -- one-off tool: restores the `username` / `display_name` of handle-keyed profiles that the profile
 * backfill rewrote with another account's name (the 2026-10-26 incident), and lists the numeric-keyed profiles
 * that may have been relabelled the same way for a human to decide.
 *
 *   npx tsx scripts/repair-rewritten-profile-usernames.ts            dry run: prints the plan, changes nothing
 *   npx tsx scripts/repair-rewritten-profile-usernames.ts --apply    restores every handle-keyed row in the plan
 *
 * Handle-keyed rows (account_id is the handle the user subscribed with): username := account_id, display_name :=
 * the newest display name the account itself published under. A row with no such post keeps its display name and
 * is flagged. Each repair is one transaction with an `account_profile_repairs` audit row.
 *
 * Numeric-keyed rows (account_id is the platform ID) are NEVER changed here: there is no handle to restore from.
 * They are listed with the vendor's ID->handle pairing so a person can decide.
 *
 * It runs against whatever DATABASE_URL points at. Applying to production needs a writer connection and the
 * `account_profile_repairs` table (migration 0083), so the ci.yml `db-migrate` job must have run first.
 */
import {
  applyHandleKeyedRepair,
  findNumericKeyedFindings,
  planHandleKeyedRepairs,
} from '../src/lib/accounts/repair-rewritten-profile-usernames.js';

async function main() {
  const apply = process.argv.includes('--apply');
  const performedBy = 'script:repair-rewritten-profile-usernames';

  console.log(`Rewritten-username repair (BUG-081). Mode: ${apply ? 'APPLY' : 'dry run (pass --apply to restore)'}\n`);

  const plans = await planHandleKeyedRepairs();
  console.log(`== Handle-keyed profiles with a rewritten username: ${plans.length} ==`);
  let repaired = 0;
  let skipped = 0;
  for (const plan of plans) {
    const displayLine =
      plan.restoreDisplayName !== null
        ? `display_name: "${plan.currentDisplayName}" -> "${plan.restoreDisplayName}" (from ${plan.displayNameEvidencePostUrl})`
        : `display_name: "${plan.currentDisplayName}" UNCHANGED (no post published by ${plan.accountId} on file; set it by hand)`;
    const summary =
      `${plan.accountId} (${plan.profileId}, updated ${plan.updatedAt.toISOString()})\n` +
      `      username: "${plan.currentUsername}" -> "${plan.restoreUsername}"\n` +
      `      ${displayLine}`;

    if (!apply) {
      console.log(`PLAN     ${summary}`);
      continue;
    }

    const result = await applyHandleKeyedRepair(plan, performedBy);
    if (result.status === 'repaired') {
      console.log(`REPAIRED ${summary}\n      audit row ${result.repairId}`);
      repaired++;
    } else {
      console.log(`SKIPPED  ${summary}\n      reason: ${result.reason}`);
      skipped++;
    }
  }

  const findings = await findNumericKeyedFindings();
  const needsDecision = findings.filter((finding) => finding.verdict !== 'LABEL_MATCHES_VENDOR');
  console.log(
    `\n== Numeric-keyed subscribed profiles needing a human decision (never changed by this script): ` +
      `${needsDecision.length} of ${findings.length} ==`
  );
  for (const finding of needsDecision) {
    const vendor = finding.vendorHandles.length > 0 ? finding.vendorHandles.join(', ') : '(none in the latest runs)';
    const owners =
      finding.postOwnerHandles.length > 0
        ? finding.postOwnerHandles.map((owner) => `${owner.handle} x${owner.posts}`).join(', ')
        : '(no posts)';
    console.log(
      `REVIEW   ${finding.accountId} (${finding.profileId}, updated ${finding.updatedAt.toISOString()}, ` +
        `${finding.activeSubscriptions} active sub(s))\n` +
        `      username: "${finding.username}"  display_name: "${finding.displayName}"\n` +
        `      vendor handle(s) for this ID: ${vendor}  => ${finding.verdict}\n` +
        `      owners of posts stored under it: ${owners}`
    );
  }

  console.log(
    `\nDone. ${apply ? `repaired=${repaired} skipped=${skipped}` : `handle-keyed=${plans.length} (dry run, nothing changed)`} ` +
      `numeric-keyed-for-review=${needsDecision.length}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
