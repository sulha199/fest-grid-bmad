import { describe, it, expect, assertType } from 'vitest';
import { OrchestratorError } from './orchestrator-error.js';
import { LLMPort, LLMCompleteOptions, LLMMessage } from './llm-port.js';
import { ExecPort, ExecRunOptions, ExecRunResult, ReadFileResult } from './exec-port.js';
import { NotifyPort, NotifySendOptions } from './notify-port.js';
import { HITLPort, HITLPromptOptions } from './hitl-port.js';

describe('Orchestrator Ports & Errors Unit Tests', () => {
  describe('OrchestratorError', () => {
    it('should correctly construct and extend Error', () => {
      const cause = new Error('Original database failure');
      const error = new OrchestratorError('Failed to fetch data', true, cause);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OrchestratorError);
      expect(error.message).toBe('Failed to fetch data');
      expect(error.recoverable).toBe(true);
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('OrchestratorError');
    });

    it('should support unrecoverable errors', () => {
      const error = new OrchestratorError('Fatal system configuration error', false);

      expect(error.recoverable).toBe(false);
      expect(error.cause).toBeUndefined();
    });
  });

  describe('Type assertions', () => {
    it('should satisfy LLMPort signature constraints', () => {
      const fakeLLM: LLMPort = {
        complete: async (options: LLMCompleteOptions): Promise<string> => {
          assertType<string>(options.role);
          assertType<string>(options.systemPrompt);
          assertType<LLMMessage[]>(options.messages);
          return `Mock response for role: ${options.role}`;
        },
      };

      expect(fakeLLM).toBeDefined();
    });

    it('should satisfy ExecPort signature constraints', () => {
      const writtenPaths: string[] = [];
      const fakeExec: ExecPort = {
        run: async (options: ExecRunOptions): Promise<ExecRunResult> => {
          assertType<string>(options.cmd);
          assertType<string[]>(options.args);
          assertType<string | undefined>(options.cwd);
          return { stdout: 'Mock stdout', stderr: '', exitCode: 0 };
        },
        readFile: async (path: string): Promise<ReadFileResult> => {
          assertType<string>(path);
          return { content: 'Mock content', fingerprint: 'fp-123' };
        },
        writeIfUnchanged: async (path: string, content: string, fingerprint: string): Promise<void> => {
          assertType<string>(path);
          assertType<string>(content);
          assertType<string>(fingerprint);
          if (fingerprint === 'stale') {
            throw new OrchestratorError('Stale fingerprint', true);
          }
          writtenPaths.push(path);
        },
        getWrittenPaths: (): string[] => {
          return writtenPaths;
        },
        resetWrittenPaths: (): void => {
          writtenPaths.length = 0;
        },
      };

      expect(fakeExec).toBeDefined();
    });

    it('should satisfy NotifyPort signature constraints', () => {
      const sentNotifications: NotifySendOptions[] = [];
      const fakeNotify: NotifyPort = {
        send: async (options: NotifySendOptions): Promise<void> => {
          assertType<string>(options.to);
          assertType<string>(options.subject);
          assertType<string>(options.body);
          sentNotifications.push(options);
        },
      };

      expect(fakeNotify).toBeDefined();
    });

    it('should satisfy HITLPort signature constraints', () => {
      const fakeHITL: HITLPort = {
        prompt: async (options: HITLPromptOptions): Promise<string> => {
          assertType<string>(options.summary);
          assertType<string | undefined>(options.expand);
          return `User choice based on: ${options.summary}`;
        },
      };

      expect(fakeHITL).toBeDefined();
    });
  });
});
