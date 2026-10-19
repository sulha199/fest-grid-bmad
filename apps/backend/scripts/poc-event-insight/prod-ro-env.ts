/**
 * Imported FIRST by prod-readonly-check.ts. The backend's db client and env loader run at import time and read DATABASE_URL (and the repository's
 * .env, which holds the application's own owner-privileged URL). This module makes the read-only role's URL the only one that can win: it reads
 * PROD_RO_DATABASE_URL, validates it, and sets DATABASE_URL to it before any other module loads. dotenv never overrides a variable already set,
 * so a .env file cannot replace it. If PROD_RO_DATABASE_URL is missing or is not the read-only role, the process stops here.
 */
import { readOnlyUrlFromEnv } from './readonly-policy.js';

process.env.DATABASE_URL = readOnlyUrlFromEnv(process.env.PROD_RO_DATABASE_URL);
process.env.BACKEND_PORT ||= '4001';
