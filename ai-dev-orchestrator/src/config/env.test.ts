import './setup-test-env.js';
import { describe, it, expect } from 'vitest';
import { parseConfig } from './env.js';

describe('Environment Configuration Loader', () => {
  const validEnv = {
    NINE_ROUTER_API_KEY: 'test-api-key',
    ORCH_MODEL_PLANNER: 'planner-model',
    ORCH_MODEL_COMPLEX: 'complex-model',
    ORCH_MODEL_SPEED: 'speed-model',
    ORCH_MODEL_TESTER: 'tester-model',
    TARGET_REPO_PATH: '/path/to/repo',
    HITL_NOTIFY_EMAIL: 'test@example.com',
    RESEND_API_KEY: 'resend-key',
  };

  it('should successfully parse environment with all valid values and apply correct defaults', () => {
    const result = parseConfig(validEnv);

    expect(result.NINE_ROUTER_API_KEY).toBe('test-api-key');
    expect(result.NINE_ROUTER_BASE_URL).toBe('http://localhost:20128/v1');
    expect(result.HITL_TIMEOUT_MS).toBe(300000);
    expect(result.MAX_AUTO_FIX_ATTEMPTS).toBe(1);
    expect(result.EXEC_TIMEOUT_MS).toBe(600000);
  });

  it('should override defaults with valid optional parameters', () => {
    const customEnv = {
      ...validEnv,
      NINE_ROUTER_BASE_URL: 'https://api.9router.com',
      HITL_TIMEOUT_MS: '150000',
      MAX_AUTO_FIX_ATTEMPTS: '3',
      EXEC_TIMEOUT_MS: '900000',
    };

    const result = parseConfig(customEnv);

    expect(result.NINE_ROUTER_BASE_URL).toBe('https://api.9router.com');
    expect(result.HITL_TIMEOUT_MS).toBe(150000);
    expect(result.MAX_AUTO_FIX_ATTEMPTS).toBe(3);
    expect(result.EXEC_TIMEOUT_MS).toBe(900000);
  });

  it('should throw an error naming missing required variables', () => {
    const incompleteEnv = {
      ORCH_MODEL_PLANNER: 'planner-model',
    };

    expect(() => parseConfig(incompleteEnv)).toThrowError(
      /Missing required environment variables: NINE_ROUTER_API_KEY, ORCH_MODEL_COMPLEX, ORCH_MODEL_SPEED, ORCH_MODEL_TESTER, TARGET_REPO_PATH, HITL_NOTIFY_EMAIL, RESEND_API_KEY/
    );
  });

  it('should throw an error for non-numeric HITL_TIMEOUT_MS', () => {
    const invalidEnv = {
      ...validEnv,
      HITL_TIMEOUT_MS: 'not-a-number',
    };

    expect(() => parseConfig(invalidEnv)).toThrowError(
      'Invalid environment variable HITL_TIMEOUT_MS: must be a number, got "not-a-number"'
    );
  });

  it('should throw an error for non-numeric EXEC_TIMEOUT_MS', () => {
    const invalidEnv = {
      ...validEnv,
      EXEC_TIMEOUT_MS: 'not-a-number',
    };

    expect(() => parseConfig(invalidEnv)).toThrowError(
      'Invalid environment variable EXEC_TIMEOUT_MS: must be a number, got "not-a-number"'
    );
  });

  it('should accept 0 as a valid MAX_AUTO_FIX_ATTEMPTS', () => {
    const customEnv = {
      ...validEnv,
      MAX_AUTO_FIX_ATTEMPTS: '0',
    };

    const result = parseConfig(customEnv);
    expect(result.MAX_AUTO_FIX_ATTEMPTS).toBe(0);
  });

  it('should throw an error for negative MAX_AUTO_FIX_ATTEMPTS', () => {
    const invalidEnv = {
      ...validEnv,
      MAX_AUTO_FIX_ATTEMPTS: '-1',
    };

    expect(() => parseConfig(invalidEnv)).toThrowError(
      'Invalid environment variable MAX_AUTO_FIX_ATTEMPTS: must be a non-negative integer, got "-1"'
    );
  });

  it('should throw an error for non-integer MAX_AUTO_FIX_ATTEMPTS', () => {
    const invalidEnv = {
      ...validEnv,
      MAX_AUTO_FIX_ATTEMPTS: '1.5',
    };

    expect(() => parseConfig(invalidEnv)).toThrowError(
      'Invalid environment variable MAX_AUTO_FIX_ATTEMPTS: must be a non-negative integer, got "1.5"'
    );
  });
});
