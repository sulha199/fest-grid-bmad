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
  apiKeyUsageCycleDays: number;
  webAppBaseUrl: string;
  scrapingQueueUrl?: string;
  aiProcessingQueueUrl?: string;
  dataIngestionQueueUrl?: string;
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

  return { 
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
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
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
    apiKeyUsageCycleDays: parseInt(process.env.API_KEY_USAGE_CYCLE_DAYS || '30', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    webAppBaseUrl: process.env.WEB_APP_BASE_URL || 'http://localhost:3000',
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapingQueueUrl: process.env.SCRAPING_QUEUE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    aiProcessingQueueUrl: process.env.AI_PROCESSING_QUEUE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    dataIngestionQueueUrl: process.env.DATA_INGESTION_QUEUE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    apifyApiToken: process.env.APIFY_API_TOKEN,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeResultsLimit: parseInt(process.env.SCRAPE_RESULTS_LIMIT || '10', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeInitialLookbackDays: parseInt(process.env.SCRAPE_INITIAL_LOOKBACK_DAYS || '7', 10),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    scrapeSkipRecentHours: parseInt(process.env.SCRAPE_SKIP_RECENT_HOURS || '20', 10),
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
  };
}
