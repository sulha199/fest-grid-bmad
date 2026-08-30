# Test Isolation Seam Audit Report

## Task 1: Seam Restore Hygiene Audit

This section categorizes all 22 test seams based on whether they correctly restore their original behavior after being mocked. A failure to restore a seam pollutes the process memory and affects subsequently executed tests.

- **SAFE**: The test file correctly restores the original function/state.
- **LEAK**: The test file sets a mock but never restores the original, poisoning subsequent files.
- **LEAK RISK**: The test file attempts to restore the seam but mistakenly restores it to another mock instead of the real implementation, or uses an unsafe mechanism.
- **N/A**: The seam setter is never called in any test file.

### 1. `setSendSqsMessage` (`apps/backend/src/lib/aws/send-sqs-message.ts:11`)
- **Category:** **LEAK** / **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts:25`: LEAK. Sets mock but has no `t.after` to restore.
  - `apps/backend/src/lib/scraper/enqueue-scrape-job.test.ts:10`: LEAK. Sets mock but has no `t.after`.
  - `apps/backend/src/schema/extraction.test.ts:347`: LEAK. Sets mock but has no `t.after`.
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts:70`: LEAK RISK. Has `t.afterEach` but mistakenly restores it to `async () => {}` instead of the original function.
- **Recommended fix:** In each file, capture the original function before mocking (e.g., `const originalSqs = sendSqsMessage;`) and restore it explicitly via `t.after(() => setSendSqsMessage(originalSqs));`.

### 2. `setSesClient` (`apps/backend/src/lib/email/ses-client.ts:15`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/email/adapter.test.ts:25`: LEAK. Sets mock `SESv2Client` but has no `t.after` block to restore.
  - `apps/backend/src/schema/system-errors.test.ts:57`: LEAK. Sets mock but its `t.after` only restores env variables, ignoring the seam.
- **Recommended fix:** Add `t.after(() => setSesClient(null));` (or the original client) to both test suites.

### 3. `setCallGeminiGenerateContent` (`apps/backend/src/lib/ai-gateway/gemini-client.ts:95`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/ai-gateway/adapter.test.ts:51`: LEAK. No restore mechanism.
  - `apps/backend/src/lib/ai-gateway/system-key-adapter.test.ts:33`: LEAK. Restores `setCallGemini` but forgets `setCallGeminiGenerateContent`.
  - `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts:89`: LEAK. `t.after` only cleans up DB rows.
  - `apps/backend/src/schema/extraction.test.ts:145`: LEAK. No restore.
  - `apps/backend/src/lib/ai-gateway/gemini-client.test.ts:14`: SAFE. Correctly stores `originalCall` and restores in `t.after`.
  - `apps/backend/src/schema/ai-event-filters.test.ts:39`: SAFE. Correctly restores.
  - `apps/backend/src/schema/api-keys.test.ts:37`: SAFE. Correctly restores.
  - `apps/backend/src/schema/subscriptions.test.ts:43`: SAFE. Correctly restores.
- **Recommended fix:** Capture `callGeminiGenerateContent` at import and add `t.after(() => setCallGeminiGenerateContent(originalCall));` to all leaking files.

### 4. `setResolveLocationSeam` (`apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts:16`)
- **Category:** **SAFE**
- **Evidence:**
  - `apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.test.ts:38`: SAFE. Test captures `resolveLocationSeam` and explicitly restores it in `t.afterEach`.
- **Recommended fix:** N/A.

### 5. `setDecryptApiKey` (`apps/backend/src/lib/ai-gateway/kms.ts:62`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/ai-gateway/adapter.test.ts:47`: LEAK. Has DB cleanup in `t.after` but forgets the seam.
  - `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts:85`: LEAK. No restore.
  - `apps/backend/src/schema/ai-event-filters.test.ts:112`: LEAK. Restores Gemini seam but not KMS.
- **Recommended fix:** Capture `decryptApiKey` on import and add `t.after(() => setDecryptApiKey(originalDecrypt));`.

### 6. `setEncryptApiKey` (`apps/backend/src/lib/ai-gateway/kms.ts:89`)
- **Category:** **N/A**
- **Evidence:** Found no usages in `apps/backend/src/**/*.test.ts`.
- **Recommended fix:** N/A.

### 7. `setCallGeminiSeam` (`apps/backend/src/lib/ai-processor/process-ai-job.ts:18`)
- **Category:** **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts:67`: LEAK RISK. File defines `t.afterEach` but restores the seam to a hardcoded mock (`async () => ({ text: '{}' })`) instead of the original real implementation.
- **Recommended fix:** Capture the real `defaultCallGemini` at import and restore to it.

### 8. `setMarkPostExtractedSeam` (`apps/backend/src/lib/ai-processor/process-ai-job.ts:23`)
- **Category:** **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts:68`: LEAK RISK. Similarly resets to a mock `async () => ({})` inside `t.afterEach`.
- **Recommended fix:** Restore to the original function.

### 9. `setRehostPostImageSeam` (`apps/backend/src/lib/ai-processor/process-ai-job.ts:28`)
- **Category:** **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts:71`: LEAK RISK. Resets to `async () => null` inside `t.afterEach`.
- **Recommended fix:** Restore to the original function.

### 10. `setBackfillAccountProfileAndInferDefaultLocationSeam` (`apps/backend/src/lib/ai-processor/process-ai-job.ts:33`)
- **Category:** **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts:72`: LEAK RISK. Resets to `async () => {}` inside `t.afterEach`.
- **Recommended fix:** Restore to the original function.

### 11. `setTriggerBrightDataJob` (`apps/backend/src/lib/scraper/brightdata-client.ts:22`)
- **Category:** **N/A**
- **Evidence:** Found no usages in `*.test.ts`.
- **Recommended fix:** N/A.


### 12. `setGetBrightDataProgress` (`apps/backend/src/lib/scraper/brightdata-client.ts:26`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/scraper/fetch-vendor-run-output.test.ts:89`: LEAK. Mock set without any restore mechanism.
- **Recommended fix:** Capture original export and add `t.after(() => setGetBrightDataProgress(original));`.

### 13. `setGetBrightDataSnapshot` (`apps/backend/src/lib/scraper/brightdata-client.ts:30`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/scraper/fetch-vendor-run-output.test.ts:90`: LEAK. Same as above.
- **Recommended fix:** Same as above.

### 14. `setCallGemini` (`apps/backend/src/lib/ai-gateway/system-key-adapter.ts:7`)
- **Category:** **SAFE**
- **Evidence:**
  - `apps/backend/src/lib/ai-gateway/system-key-adapter.test.ts:16`: SAFE. Restores `setCallGemini(callGeminiRef)` in `t.after`.
- **Recommended fix:** N/A.

### 15. `setS3ClientInstance` (`apps/backend/src/lib/ai-processor/rehost-post-image.ts:9`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts:65`: LEAK. Sets mock S3 instance but never restores the original.
- **Recommended fix:** Capture original S3 instance and restore via `t.after`.

### 16. `setResolveLocationSeam` (`apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts:10`)
- **Category:** **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/ai-processor/resolve-account-and-locations.test.ts:42`: LEAK RISK. Restores the seam to a mock `async (q) => ({}) as any` inside `t.afterEach`.
- **Recommended fix:** Restore to the original function.

### 17. `setSendEventNotificationsSeam` (`apps/backend/src/lib/notifications/send-event-notifications.ts:31`)
- **Category:** **LEAK RISK**
- **Evidence:**
  - `apps/backend/src/lib/ingestor/process-ingestion-job.test.ts:87`: LEAK RISK. Restores to `async () => {}` inside `t.after`.
- **Recommended fix:** Restore to original function.

### 18. `setGetApifyClient` (`apps/backend/src/lib/scraper/instagram-adapter.ts:131`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/scraper/fetch-vendor-run-output.test.ts:10`: LEAK. Sets mock but has no `t.after`.
- **Recommended fix:** Capture and restore the original function.

### 19. `setCallApifyActor` (`apps/backend/src/lib/scraper/instagram-adapter.ts:168`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/scraper/instagram-adapter.test.ts:40`: LEAK. Sets mock without a restore in its `t.afterEach`.
  - `apps/backend/src/schema/extraction.test.ts:229`: LEAK. Sets mock without any restore mechanism.
- **Recommended fix:** Capture and restore the original function.

### 20. `setApifyAuditContext` (`apps/backend/src/lib/scraper/instagram-adapter.ts:172`)
- **Category:** **N/A**
- **Evidence:** Found no usages in `*.test.ts`.
- **Recommended fix:** N/A.

### 21. `setBackfillAccountProfileAndInferDefaultLocationSeam` (`apps/backend/src/lib/scraper/process-scrape-job.ts:12`)
- **Category:** **SAFE**
- **Evidence:**
  - `apps/backend/src/lib/scraper/process-scrape-job.test.ts:327`: SAFE. It explicitly captures and restores `backfillAccountProfileAndInferDefaultLocationSeam` via `subT.after()`.
- **Recommended fix:** N/A.

### 22. `setAttemptApifyAsyncTrigger` (`apps/backend/src/lib/scraper/trigger-apify-for-target.ts:86`)
- **Category:** **LEAK**
- **Evidence:**
  - `apps/backend/src/lib/scraper/trigger-apify-for-target.test.ts:87`: LEAK. Declares `const originalTrigger` but forgets to use it to restore.
  - `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts:36`: LEAK. No restore.
- **Recommended fix:** Add `t.after(() => setAttemptApifyAsyncTrigger(originalTrigger));`.


---

## Task 2: Root-Cause Analysis for Undiagnosed Failures

### 1. `apps/backend/src/lib/geolocation/adapter.test.ts`
- **Confirmed Mechanism:** This is a **pre-existing assertion bug**, completely unrelated to test isolation or cross-file state leaks.
- **Evidence:**
  - **Reproduction:** Running the test entirely isolated (`pnpm exec tsx --test src/lib/geolocation/adapter.test.ts`) causes the exact same failure (`1 subtest failed: adapter resolveLocation integration`).
  - **Root Cause:** The `resolveLocation` function relies on `mapGeoapifyFeature` which explicitly sets missing properties to `undefined` (i.e. `city: feature.properties.city`). In Node 20+, `assert.deepEqual` and `assert.deepStrictEqual` strictly check for explicit `undefined` properties. The test suite's `expected` assertion object simply omits the `city` and `province` keys entirely, triggering `Expected values to be strictly deep-equal: actual has + city: undefined, + province: undefined`.

### 2. `apps/backend/src/lib/geolocation/geoapify-client.test.ts`
- **Confirmed Mechanism:** Also a **pre-existing assertion bug**, identical to `adapter.test.ts`.
- **Evidence:**
  - **Reproduction:** Fails independently when run isolated (`pnpm exec tsx --test src/lib/geolocation/geoapify-client.test.ts`).
  - **Root Cause:** The three failing subtests (`geocodeAddress`, `reverseGeocode`, `getPlaceDetails`) use the same `mapGeoapifyFeature` return value pattern and the identical incorrectly-shaped expected object missing explicit `city: undefined` and `province: undefined` fields.

**Recommended fix for both:** Add explicit `city: undefined` and `province: undefined` fields to the `locationDetails` object / expected assertions in both files.
