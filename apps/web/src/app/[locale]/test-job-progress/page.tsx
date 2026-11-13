import { notFound } from 'next/navigation';
import { JobProgressFixture } from './job-progress-fixture';

export const dynamic = 'force-dynamic';

/**
 * Story 10.4 Part C -- a fixture page for the popups Playwright matrix (`responsive-popups.spec.ts`). The progress dialog has no start point in
 * the app until the adoption stories (Story 10.6a and the later ones) mount it, so the matrix opens it here with fixed data and no network.
 * Served only on the local e2e stack (`E2E_FAKE_AUTH=1`, which is refused unless the database and servers are local); a real deployment
 * never sets it, so the route reads as not found there.
 */
export default function TestJobProgressPage() {
  if (process.env.E2E_FAKE_AUTH !== '1') notFound();
  return <JobProgressFixture />;
}
