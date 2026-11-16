import { REEXTRACT_POST_JOB_TYPE, parseReextractPostInput, reextractPostInputKey, reextractUrlInputKey, withoutHeldPost } from '@festgrid/domain/jobs';
import { startReextractPostJobDetailed } from '../extraction/start-reextract-post-job.js';
import { registerJobRetryStarter, toJobRetryStartResult } from './job-retry-registry.js';

// Story 10.4 (AC8) -- the first retry starter: the moderator re-extract. It goes through `startReextractPostJobDetailed`, the same start
// path the moderator screen uses (admission, reuse, the stuck-job rule), with the identity of the old job (its post id or URL) and
// NEVER its held caption (AD-40 Rule 9; `withoutHeldPost`). It stays moderator-only like the screen it retries.
// The API Lambda's resolver module imports this file once; a new job type adds its own registration next to its start function.

registerJobRetryStarter(REEXTRACT_POST_JOB_TYPE, {
  moderatorOnly: true,
  async start({ ownerUserId, input }) {
    const target = parseReextractPostInput(withoutHeldPost(input));
    if (!target) {
      // The old job has no usable identity (never expected): refuse as a failed start rather than guess.
      return { outcome: 'REFUSED', errorCode: 'JOB_START_FAILED' };
    }
    const inputKey = 'postId' in target ? reextractPostInputKey(target.postId) : reextractUrlInputKey(target.url);
    return toJobRetryStartResult(await startReextractPostJobDetailed(ownerUserId, { inputKey, payload: target }));
  },
});
