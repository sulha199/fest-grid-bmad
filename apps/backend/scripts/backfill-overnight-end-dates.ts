/**
 * One-off tool: gives overnight schedules ("21:00 - 02:00" saved with no end date) the next day as
 * their end date, so they stop reading "Ended" before they start. New extractions are already
 * normalized at ingestion (`buildEventInsertValues`); this repairs rows written before that.
 *
 *   npx tsx scripts/backfill-overnight-end-dates.ts            dry run: prints the plan, changes nothing
 *   npx tsx scripts/backfill-overnight-end-dates.ts --apply    writes the new end dates
 *
 * Runs against whatever DATABASE_URL points at. Applying to production needs a writer connection;
 * review the dry-run list first (an extraction that misread "02:00" would be corrected to a
 * two-day event, so spot-check a few).
 */
import { findOvernightEndDateFixes, applyOvernightEndDateFixes } from '../src/lib/events/backfill-overnight-end-dates.js';

async function main() {
  const apply = process.argv.includes('--apply');
  const fixes = await findOvernightEndDateFixes();

  console.log(`${fixes.length} schedule(s) to fix. Mode: ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}\n`);
  for (const fix of fixes) {
    console.log(
      `${apply ? 'FIX ' : 'PLAN'}  schedule ${fix.scheduleId} (event ${fix.eventId}): ` +
        `${fix.eventStartDate} ${fix.eventStartTime} -> ${fix.eventEndTime}, ` +
        `end date ${fix.currentEndDate ?? '(none)'} => ${fix.newEndDate}`
    );
  }

  if (apply && fixes.length > 0) {
    const updated = await applyOvernightEndDateFixes(fixes);
    const skipped = fixes.length - updated;
    console.log(`\nUpdated ${updated} of ${fixes.length} schedule(s)${skipped > 0 ? `; ${skipped} changed since the plan and were skipped` : ''}.`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
