export interface OrchestratorConfig {
  readonly NINE_ROUTER_BASE_URL: string;
  readonly NINE_ROUTER_API_KEY: string;
  readonly ORCH_MODEL_PLANNER: string;
  readonly ORCH_MODEL_COMPLEX: string;
  readonly ORCH_MODEL_SPEED: string;
  readonly ORCH_MODEL_TESTER: string;
  readonly TARGET_REPO_PATH: string;
  readonly HITL_NOTIFY_EMAIL: string;
  readonly HITL_TIMEOUT_MS: number;
  readonly MAX_AUTO_FIX_ATTEMPTS: number;
  readonly RESEND_API_KEY: string;
  readonly EXEC_TIMEOUT_MS: number;
}

export function parseConfig(env: Record<string, string | undefined>): OrchestratorConfig {
  const missing: string[] = [];

  const requiredKeys = [
    'NINE_ROUTER_API_KEY',
    'ORCH_MODEL_PLANNER',
    'ORCH_MODEL_COMPLEX',
    'ORCH_MODEL_SPEED',
    'ORCH_MODEL_TESTER',
    'TARGET_REPO_PATH',
    'HITL_NOTIFY_EMAIL',
    'RESEND_API_KEY',
  ] as const;

  for (const key of requiredKeys) {
    if (!env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Parse NINE_ROUTER_BASE_URL (optional, default: http://localhost:20128/v1)
  const NINE_ROUTER_BASE_URL = env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1';

  // Parse HITL_TIMEOUT_MS (optional, default: 300000)
  const rawHitlTimeout = env.HITL_TIMEOUT_MS;
  let HITL_TIMEOUT_MS = 300000;
  if (rawHitlTimeout !== undefined) {
    const parsed = Number(rawHitlTimeout);
    if (isNaN(parsed)) {
      throw new Error(`Invalid environment variable HITL_TIMEOUT_MS: must be a number, got "${rawHitlTimeout}"`);
    }
    HITL_TIMEOUT_MS = parsed;
  }

  // Parse MAX_AUTO_FIX_ATTEMPTS (optional, default: 1)
  const rawMaxAttempts = env.MAX_AUTO_FIX_ATTEMPTS;
  let MAX_AUTO_FIX_ATTEMPTS = 1;
  if (rawMaxAttempts !== undefined) {
    const parsed = Number(rawMaxAttempts);
    if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`Invalid environment variable MAX_AUTO_FIX_ATTEMPTS: must be a non-negative integer, got "${rawMaxAttempts}"`);
    }
    MAX_AUTO_FIX_ATTEMPTS = parsed;
  }

  // Parse EXEC_TIMEOUT_MS (optional, default: 600000)
  const rawExecTimeout = env.EXEC_TIMEOUT_MS;
  let EXEC_TIMEOUT_MS = 600000;
  if (rawExecTimeout !== undefined) {
    const parsed = Number(rawExecTimeout);
    if (isNaN(parsed)) {
      throw new Error(`Invalid environment variable EXEC_TIMEOUT_MS: must be a number, got "${rawExecTimeout}"`);
    }
    EXEC_TIMEOUT_MS = parsed;
  }

  return Object.freeze({
    NINE_ROUTER_BASE_URL,
    NINE_ROUTER_API_KEY: env.NINE_ROUTER_API_KEY!,
    ORCH_MODEL_PLANNER: env.ORCH_MODEL_PLANNER!,
    ORCH_MODEL_COMPLEX: env.ORCH_MODEL_COMPLEX!,
    ORCH_MODEL_SPEED: env.ORCH_MODEL_SPEED!,
    ORCH_MODEL_TESTER: env.ORCH_MODEL_TESTER!,
    TARGET_REPO_PATH: env.TARGET_REPO_PATH!,
    HITL_NOTIFY_EMAIL: env.HITL_NOTIFY_EMAIL!,
    HITL_TIMEOUT_MS,
    MAX_AUTO_FIX_ATTEMPTS,
    RESEND_API_KEY: env.RESEND_API_KEY!,
    EXEC_TIMEOUT_MS,
  });
}

// Synchronously parsed configuration object.
export const config = parseConfig(process.env);
