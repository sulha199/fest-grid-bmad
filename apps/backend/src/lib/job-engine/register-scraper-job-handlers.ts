import { REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import { reextractLateResultHandler } from '../extraction/reextract-late-result-handler.js';
import { reextractRefreshHandler } from '../extraction/reextract-refresh-handler.js';
import { registerJobHandler, registerLateResultHandler } from './job-registry.js';

// Story 10.6 (AD-53 Rules 2, 11 and 17) -- the handlers a job type needs in the SCRAPER Lambda, registered once at its cold start
// (`lambdas/scraper.ts`). The pure definitions are in `packages/domain` (registered when `@festgrid/domain/jobs` is imported), so the
// API Lambda never imports this file. Later adoption stories add their types here.
export function registerScraperJobHandlers(): void {
  registerJobHandler(REEXTRACT_POST_JOB_TYPE, reextractRefreshHandler);
  registerLateResultHandler(REEXTRACT_POST_JOB_TYPE, reextractLateResultHandler);
}
