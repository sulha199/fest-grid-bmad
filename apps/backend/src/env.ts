import * as dotenv from 'dotenv';
import { resolve } from 'path';

export interface BackendEnv {
  port: number;
  supabaseUrl?: string;
  databaseUrl?: string;
  geoapifyApiKey?: string;
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  sesFromEmailAddress?: string;
  systemErrorAlertEmail?: string;
  byokKmsKeyId?: string;
  geminiModel: string;
  apiKeyInvalidAttemptsThreshold: number;
  geminiPostsPerKeyPerCycle: number;
  apiKeyUsageCycleDays: number;
  webAppBaseUrl: string;
  // Batch cap for how many additional carousel (Sidecar) slide images are sent to Gemini in a
  // single extraction request, beyond the cover image (Story 3.6l). Keeps the AI Processor
  // Lambda inside its fixed 300s timeout (AD-13) and bounds per-request token usage.
  maxCarouselImages: number;
  // Story 3.6s (AD-30 Rule 5) — roundup per-post event cap, default 10, configurable. Used both
  // as the Gemini-facing schema's `events.maxItems` hint and as the code-level truncation
  // backstop in process-ai-job.ts (never a hard AJV cap -- see extracted-event.schema.ts).
  maxExtractedEventsPerPost: number;
  // Story 3.6s (AC7, readiness-sweep correction 2026-10-01) — an explicit response-size cap on
  // the Gemini extraction call (Epic 0's guarded vendor-call wrapper, 0.i2c, does not exist yet).
  geminiMaxOutputTokens: number;
  // Story 3.6s (AC7) — AbortController-based request timeout for the Gemini extraction call,
  // in milliseconds. Default 120000ms leaves ~180s of headroom inside the AI Processor Lambda's
  // fixed 300s timeout (apps/infrastructure/lib/festgrid-backend-stack.ts) for image fetching
  // (before the call) and DB/enqueue work (after it). A timeout throws GeminiTimeoutError, which
  // propagates unretried out of processAiJob as a retryable job failure (never a silent hang).
  geminiExtractionTimeoutMs: number;
  scrapingQueueUrl?: string;
  scrapeInlineFallbackEnabled: boolean;
  aiProcessingQueueUrl?: string;
  // Story 4.2b -- AI Lambda function name the API Lambda async-invokes for manual extraction.
  aiProcessorFunctionName?: string;
  aiProcessingInlineFallbackEnabled: boolean;
  // Story 3.6z (AC3) — TTL (minutes) for enqueuePostForProcessing's atomic claim
  // (posts.queued_for_extraction_at). Default derivation: AIProcessingQueue's visibility
  // timeout (300s) x maxReceiveCount (3) = 900s (15 min) worst-case time from first claim to
  // the message landing in its DLQ (apps/infrastructure/lib/festgrid-backend-stack.ts). 30
  // minutes gives a safety margin above that so a legitimately-still-retrying message's claim
  // is never prematurely reclaimed by another enqueue attempt on the same post.
  postExtractionClaimTtlMinutes: number;
  dataIngestionQueueUrl?: string;
  dataIngestionInlineFallbackEnabled: boolean;
  apifyApiToken?: string;
  scrapeResultsLimit: number;
  scrapeInitialLookbackDays: number;
  scrapeSkipRecentHours: number;
  scraperMonthlyBudgetUsd: number;
  scraperPricePerThousandItemsUsd: number;
  scraperCapacityThresholdRatio: number;
  scraperUsageCycleDays: number;
  queueNotificationThresholdDays: number;
  queueNotificationThresholdCount: number;
  queueNotificationCooldownDays: number;
  scraperProviderAlertThresholdDays: number;
  scraperProviderAlertCooldownDays: number;
  // Bright Data integration env vars
  brightdataApiToken?: string;
  brightdataDatasetId?: string;
  brightdataWebhookBaseUrl?: string;
  brightdataJobTimeoutMinutes?: number;
  brightdataPricePerThousandItemsUsd?: number;
  brightdataMonthlyBudgetUsd?: number;
  brightdataWebhookSecret?: string;
  brightdataWebhookDlqArn?: string;
  // Apify integration env vars
  apifyWebhookBaseUrl?: string;
  apifyJobTimeoutMinutes?: number;
  // Unprocessed payload retention
  unprocessedPayloadRetentionDays?: string;
  // Scrape in-progress timeout
  scrapeInProgressTimeoutHours?: string;
  systemGeminiApiKey?: string;
  postMediaBucketName?: string;
  postMediaCdnDomain?: string;
  postMediaDistributionId?: string;
  // Below this AI-inference confidence score (0.0-1.0), a Default Location change is held as
  // AWAITING_APPROVAL instead of applying immediately (added 2026-08-28)
  locationInferenceConfidenceThreshold: number;
  // Story 3.16 — TTL (minutes) for subscribeToAccount's atomic classification claim
  // (social_media_account_profiles.classification_claimed_at). Same 30-minute default and
  // reclaim-after-TTL rationale as postExtractionClaimTtlMinutes (Story 3.6z) above.
  accountClassificationClaimTtlMinutes: number;
  // Story 3.6n (AC5) — remaining-time floor (ms), read from the Lambda Context's
  // getRemainingTimeInMillis() before starting face detection. Below this floor, the stage is
  // skipped defensively rather than risking an AWS-enforced hard kill mid-stage. The 60000ms
  // (60s) default is a conservative placeholder -- Story 0.46's real measurement (worst-case
  // stage ~1.1s locally, ~277x headroom against the 300s Lambda timeout/queue visibility
  // timeout) found headroom is NOT thin, so this guard is a cheap safety check, not a design
  // driver, and the placeholder default was kept as-is rather than tuned tighter.
  faceBlurMinRemainingTimeMs: number;
  // Story 3.20 (AD-28 Rule 10) — default-ON gate for blurring every image (cover + carousel
  // slides) before it is sent to Gemini, unless the post's PUBLISHER account has opted in to
  // image storage. This is the first default-on boolean env var in this file -- see
  // parseBooleanDefaultOn below for why it needs its own parser (all other booleans here are
  // default-off, `=== 'true'`).
  blurFacesBeforeAi: boolean;
}

function parseNonNegativeInt(value: string | undefined, name: string, defaultValue: number): number {
  const parsed = Number.parseInt(value || String(defaultValue), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

// Story 3.20 (Task 1.1) -- unlike this file's other boolean env vars (all default OFF via a
// plain `=== 'true'` check), BLUR_FACES_BEFORE_AI defaults ON: unset -> true; only an explicit
// 'false'/'0' (case-insensitive, trimmed) turns it off; any other value -> true.
export function parseBooleanDefaultOn(value: string | undefined, name: string): boolean {
  if (value === undefined) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  if (normalized !== 'true' && normalized !== '1' && normalized !== '') {
    // Fail-safe stays ON, but an operator who typed 'off'/'no' during an incident must not be
    // silently ignored.
    console.warn(`${name}="${value}" is not a recognised boolean; treating as ON. Use 'false' or '0' to disable.`);
  }
  return true;
}

/** Validate that required Bright Data vars are present */
function assertBrightDataEnv(env: BackendEnv) {
  const missing: string[] = [];
  if (!env.brightdataApiToken) missing.push('BRIGHTDATA_API_TOKEN');
  if (!env.brightdataDatasetId) missing.push('BRIGHTDATA_DATASET_ID');
  if (!env.brightdataWebhookBaseUrl) missing.push('BRIGHTDATA_WEBHOOK_BASE_URL');
  if (missing.length) {
    throw new Error(`Missing required Bright Data environment variables: ${missing.join(', ')}. Please add them to your .env file.`);
  }
}

export function loadBackendEnv(): BackendEnv {
  // Read relative to this file's position to ensure it finds root .env regardless of process.cwd()
  let resolvedDir = '';
  if (typeof __dirname !== 'undefined') {
    resolvedDir = __dirname;
  } else {
    resolvedDir = resolve(process.cwd(), 'src');
  }

  dotenv.config({ path: resolve(resolvedDir, '../../../.env') });
  dotenv.config({ path: resolve(resolvedDir, '../../.env') });
  // Fallbacks for various cwd environments
  dotenv.config({ path: resolve(process.cwd(), '../../.env') });
  dotenv.config({ path: resolve(process.cwd(), '.env') });

  const portStr = process.env.BACKEND_PORT;
  if (!portStr) {
    throw new Error('BACKEND_PORT is not defined in environment variables.');
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    throw new Error('BACKEND_PORT must be a valid number.');
  }

  const env: BackendEnv = {
    port,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    supabaseUrl: process.env.SUPABASE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    databaseUrl: process.env.DATABASE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    geoapifyApiKey: process.env.GEOAPIFY_API_KEY,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n') : undefined,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    sesFromEmailAddress: process.env.SES_FROM_EMAIL_ADDRESS,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    systemErrorAlertEmail: process.env.SYSTEM_ERROR_ALERT_EMAIL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    byokKmsKeyId: process.env.BYOK_KMS_KEY_ID,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    apiKeyInvalidAttemptsThreshold: parseInt(process.env.API_KEY_INVALID_ATTEMPTS_THRESHOLD || '5', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    geminiPostsPerKeyPerCycle: parseNonNegativeInt(
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      process.env.GEMINI_POSTS_PER_KEY_PER_CYCLE,
      'GEMINI_POSTS_PER_KEY_PER_CYCLE',
      300
    ),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    apiKeyUsageCycleDays: parseInt(process.env.API_KEY_USAGE_CYCLE_DAYS || '30', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    webAppBaseUrl: process.env.WEB_APP_BASE_URL || 'http://localhost:3000',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapingQueueUrl: process.env.SCRAPING_QUEUE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeInlineFallbackEnabled: process.env.SCRAPE_INLINE_FALLBACK_ENABLED === 'true',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    aiProcessingQueueUrl: process.env.AI_PROCESSING_QUEUE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    aiProcessorFunctionName: process.env.AI_PROCESSOR_FUNCTION_NAME,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    aiProcessingInlineFallbackEnabled: process.env.AI_PROCESSING_INLINE_FALLBACK_ENABLED === 'true',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    postExtractionClaimTtlMinutes: parseInt(process.env.POST_EXTRACTION_CLAIM_TTL_MINUTES || '30', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    dataIngestionQueueUrl: process.env.DATA_INGESTION_QUEUE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    dataIngestionInlineFallbackEnabled: process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED === 'true',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    apifyApiToken: process.env.APIFY_API_TOKEN,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeResultsLimit: parseInt(process.env.SCRAPE_RESULTS_LIMIT || '30', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    maxCarouselImages: parseInt(process.env.MAX_CAROUSEL_IMAGES || '5', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    maxExtractedEventsPerPost: parseInt(process.env.MAX_EXTRACTED_EVENTS_PER_POST || '10', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    geminiMaxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '8192', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    geminiExtractionTimeoutMs: parseInt(process.env.GEMINI_EXTRACTION_TIMEOUT_MS || '120000', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeInitialLookbackDays: parseInt(process.env.SCRAPE_INITIAL_LOOKBACK_DAYS || '7', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeSkipRecentHours: parseInt(process.env.SCRAPE_SKIP_RECENT_HOURS || '12', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scraperMonthlyBudgetUsd: parseFloat(process.env.SCRAPER_MONTHLY_BUDGET_USD || '5.00'),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scraperPricePerThousandItemsUsd: parseFloat(process.env.SCRAPER_PRICE_PER_1000_ITEMS_USD || '2.70'),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scraperCapacityThresholdRatio: parseFloat(process.env.SCRAPER_CAPACITY_THRESHOLD_RATIO || '0.9'),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scraperUsageCycleDays: parseInt(process.env.SCRAPER_USAGE_CYCLE_DAYS || '30', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    queueNotificationThresholdDays: parseInt(process.env.QUEUE_NOTIFICATION_THRESHOLD_DAYS || '3', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    queueNotificationThresholdCount: parseInt(process.env.QUEUE_NOTIFICATION_THRESHOLD_COUNT || '3', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    queueNotificationCooldownDays: parseInt(process.env.QUEUE_NOTIFICATION_COOLDOWN_DAYS || '7', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scraperProviderAlertThresholdDays: parseInt(process.env.SCRAPER_PROVIDER_ALERT_THRESHOLD_DAYS || '2', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scraperProviderAlertCooldownDays: parseInt(process.env.SCRAPER_PROVIDER_ALERT_COOLDOWN_DAYS || '3', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    locationInferenceConfidenceThreshold: parseFloat(process.env.LOCATION_INFERENCE_CONFIDENCE_THRESHOLD || '0.5'),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataApiToken: process.env.BRIGHTDATA_API_TOKEN,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataDatasetId: process.env.BRIGHTDATA_DATASET_ID || 'gd_lk5ns7kz21pck8jpis',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataWebhookBaseUrl: process.env.BRIGHTDATA_WEBHOOK_BASE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataJobTimeoutMinutes: parseInt(process.env.BRIGHTDATA_JOB_TIMEOUT_MINUTES || '180', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataPricePerThousandItemsUsd: parseFloat(process.env.BRIGHTDATA_PRICE_PER_1000_ITEMS_USD || '1.50'),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataMonthlyBudgetUsd: parseFloat(process.env.BRIGHTDATA_MONTHLY_BUDGET_USD || '7.50'),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataWebhookSecret: process.env.BRIGHTDATA_WEBHOOK_SECRET,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    brightdataWebhookDlqArn: process.env.BRIGHTDATA_WEBHOOK_DLQ_ARN,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    apifyWebhookBaseUrl: process.env.APIFY_WEBHOOK_BASE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    apifyJobTimeoutMinutes: parseInt(process.env.APIFY_JOB_TIMEOUT_MINUTES || '180', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    unprocessedPayloadRetentionDays: process.env.UNPROCESSED_PAYLOAD_RETENTION_DAYS || '30',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeInProgressTimeoutHours: process.env.SCRAPE_IN_PROGRESS_TIMEOUT_HOURS || '3',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    systemGeminiApiKey: process.env.SYSTEM_GEMINI_API_KEY,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    postMediaBucketName: process.env.POST_MEDIA_BUCKET_NAME,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    postMediaCdnDomain: process.env.POST_MEDIA_CDN_DOMAIN,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    postMediaDistributionId: process.env.POST_MEDIA_DISTRIBUTION_ID,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    accountClassificationClaimTtlMinutes: parseInt(process.env.ACCOUNT_CLASSIFICATION_CLAIM_TTL_MINUTES || '30', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    faceBlurMinRemainingTimeMs: parseNonNegativeInt(process.env.FACE_BLUR_MIN_REMAINING_TIME_MS, 'FACE_BLUR_MIN_REMAINING_TIME_MS', 60000),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    blurFacesBeforeAi: parseBooleanDefaultOn(process.env.BLUR_FACES_BEFORE_AI, 'BLUR_FACES_BEFORE_AI'),
  };

  // Ensure required Bright Data variables are present (webhook base URL is set post-deploy by CDK)
  // For local dev without CDK, skip this check if BRIGHTDATA_WEBHOOK_BASE_URL is not set
  // assertBrightDataEnv(env);

  return env;
}
