import '../config/setup-test-env.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NineRouterLLMAdapter } from './nine-router-llm-adapter.js';
import { OrchestratorError } from '../core/ports/orchestrator-error.js';
import { OrchestratorConfig } from '../config/env.js';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    OpenAI: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('NineRouterLLMAdapter', () => {
  const mockConfig: OrchestratorConfig = {
    NINE_ROUTER_BASE_URL: 'http://localhost:20128/v1',
    NINE_ROUTER_API_KEY: 'test-api-key',
    ORCH_MODEL_PLANNER: 'planner-alias',
    ORCH_MODEL_COMPLEX: 'complex-alias',
    ORCH_MODEL_SPEED: 'speed-alias',
    ORCH_MODEL_TESTER: 'tester-alias',
    TARGET_REPO_PATH: '/path/to/repo',
    HITL_NOTIFY_EMAIL: 'test@example.com',
    HITL_TIMEOUT_MS: 300000,
    MAX_AUTO_FIX_ATTEMPTS: 1,
    RESEND_API_KEY: 'resend-key',
    EXEC_TIMEOUT_MS: 600000,
  };

  let adapter: NineRouterLLMAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NineRouterLLMAdapter(mockConfig);
  });

  it('should call completions with the correct resolved alias for "planner" role', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Planner output' } }],
    });

    const result = await adapter.complete({
      role: 'planner',
      systemPrompt: 'You are a planner.',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result).toBe('Planner output');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'planner-alias',
      messages: [
        { role: 'system', content: 'You are a planner.' },
        { role: 'user', content: 'hello' },
      ],
    });
  });

  it('should call completions with the correct resolved alias for "complex" role', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Complex output' } }],
    });

    const result = await adapter.complete({
      role: 'complex',
      systemPrompt: 'You are complex.',
      messages: [{ role: 'user', content: 'complex query' }],
    });

    expect(result).toBe('Complex output');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'complex-alias',
      messages: [
        { role: 'system', content: 'You are complex.' },
        { role: 'user', content: 'complex query' },
      ],
    });
  });

  it('should call completions with the correct resolved alias for "speed" role', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Speed output' } }],
    });

    const result = await adapter.complete({
      role: 'speed',
      systemPrompt: 'You are fast.',
      messages: [{ role: 'user', content: 'speed query' }],
    });

    expect(result).toBe('Speed output');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'speed-alias',
      messages: [
        { role: 'system', content: 'You are fast.' },
        { role: 'user', content: 'speed query' },
      ],
    });
  });

  it('should call completions with the correct resolved alias for "tester" role', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Tester output' } }],
    });

    const result = await adapter.complete({
      role: 'tester',
      systemPrompt: 'You are a tester.',
      messages: [{ role: 'user', content: 'test query' }],
    });

    expect(result).toBe('Tester output');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'tester-alias',
      messages: [
        { role: 'system', content: 'You are a tester.' },
        { role: 'user', content: 'test query' },
      ],
    });
  });

  it('should throw OrchestratorError if role is not recognized', async () => {
    await expect(
      adapter.complete({
        role: 'invalid-role',
        systemPrompt: 'Prompt',
        messages: [],
      })
    ).rejects.toThrowError('Unsupported LLM role: "invalid-role"');
  });

  it('should omit system message if systemPrompt is empty', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'No system prompt' } }],
    });

    const result = await adapter.complete({
      role: 'speed',
      systemPrompt: '',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result).toBe('No system prompt');
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'speed-alias',
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  it('should map 401 Unauthorized HTTP errors to unrecoverable OrchestratorError', async () => {
    const apiError = new Error('Unauthorized');
    (apiError as any).status = 401;
    mockCreate.mockRejectedValueOnce(apiError);

    try {
      await adapter.complete({
        role: 'speed',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'hello' }],
      });
      throw new Error('Expected complete to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.message).toContain('OpenAI Authentication/Authorization failed: Unauthorized');
      expect(err.recoverable).toBe(false);
      expect(err.cause).toBe(apiError);
    }
  });

  it('should map 403 Forbidden HTTP errors to unrecoverable OrchestratorError', async () => {
    const apiError = new Error('Forbidden');
    (apiError as any).status = 403;
    mockCreate.mockRejectedValueOnce(apiError);

    try {
      await adapter.complete({
        role: 'speed',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'hello' }],
      });
      throw new Error('Expected complete to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.message).toContain('OpenAI Authentication/Authorization failed: Forbidden');
      expect(err.recoverable).toBe(false);
      expect(err.cause).toBe(apiError);
    }
  });

  it('should map 500 Internal Server errors to recoverable OrchestratorError', async () => {
    const apiError = new Error('Internal Server Error');
    (apiError as any).status = 500;
    mockCreate.mockRejectedValueOnce(apiError);

    try {
      await adapter.complete({
        role: 'speed',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'hello' }],
      });
      throw new Error('Expected complete to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.message).toContain('OpenAI API call failed: Internal Server Error');
      expect(err.recoverable).toBe(true);
      expect(err.cause).toBe(apiError);
    }
  });

  it('should map network errors (no status code) to recoverable OrchestratorError', async () => {
    const apiError = new Error('Network Connection Lost');
    mockCreate.mockRejectedValueOnce(apiError);

    try {
      await adapter.complete({
        role: 'speed',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'hello' }],
      });
      throw new Error('Expected complete to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.message).toContain('OpenAI API call failed: Network Connection Lost');
      expect(err.recoverable).toBe(true);
      expect(err.cause).toBe(apiError);
    }
  });

  it('should map 429 Rate Limit HTTP errors to recoverable OrchestratorError', async () => {
    const apiError = new Error('Too Many Requests');
    (apiError as any).status = 429;
    mockCreate.mockRejectedValueOnce(apiError);

    try {
      await adapter.complete({
        role: 'speed',
        systemPrompt: '',
        messages: [{ role: 'user', content: 'hello' }],
      });
      throw new Error('Expected complete to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.message).toContain('OpenAI API call failed: Too Many Requests');
      expect(err.recoverable).toBe(true);
      expect(err.cause).toBe(apiError);
    }
  });
});
