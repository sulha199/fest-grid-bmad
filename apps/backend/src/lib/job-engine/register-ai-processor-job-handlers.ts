import { REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import { reextractPreviewHandler } from '../ai-processor/reextract-preview-handler.js';
import { registerJobHandler } from './job-registry.js';

// Story 10.6 (AD-53 Rules 2, 8 and 17) -- the handlers a job type needs in the AI-PROCESSOR Lambda, registered once at its cold start
// (`lambdas/ai-processor.ts`): phase 2 of a scrape-then-extract job, which the Scraper Lambda hands off to. The Scraper registers
// phase 1 under the same type (`register-scraper-job-handlers.ts`): a Lambda holds only its own half.
export function registerAiProcessorJobHandlers(): void {
  registerJobHandler(REEXTRACT_POST_JOB_TYPE, reextractPreviewHandler);
}
