import './config/setup-test-env.js';
import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { bootstrapNodeContext } from './bootstrap.js';
import { NineRouterLLMAdapter } from './adapters/nine-router-llm-adapter.js';
import { LocalExecAdapter } from './adapters/local-exec-adapter.js';
import { OrchestratorError } from './core/ports/orchestrator-error.js';

describe('Bootstrap Composition Root', () => {
  const realProjectRoot = fs.existsSync(path.resolve(process.cwd(), '_bmad'))
    ? path.resolve(process.cwd())
    : path.resolve(process.cwd(), '..');

  const validEnv = {
    NINE_ROUTER_API_KEY: 'test-nine-router-key',
    ORCH_MODEL_PLANNER: 'planner-model',
    ORCH_MODEL_COMPLEX: 'complex-model',
    ORCH_MODEL_SPEED: 'speed-model',
    ORCH_MODEL_TESTER: 'tester-model',
    TARGET_REPO_PATH: realProjectRoot,
    HITL_NOTIFY_EMAIL: 'test@example.com',
    RESEND_API_KEY: 'resend-key',
  };

  test('should successfully bootstrap a valid NodeContext with real project configuration', async () => {
    const ctx = await bootstrapNodeContext(validEnv);

    expect(ctx.config.NINE_ROUTER_API_KEY).toBe('test-nine-router-key');
    expect(ctx.ports.llm).toBeInstanceOf(NineRouterLLMAdapter);
    expect(ctx.ports.exec).toBeInstanceOf(LocalExecAdapter);
    expect(ctx.ports.notify).toBeDefined();
    expect(ctx.ports.hitl).toBeDefined();

    expect(ctx.runId).toBeDefined();
    expect(ctx.logger).toBeDefined();

    expect(ctx.paths.planningArtifacts).toBe(path.join(realProjectRoot, '_bmad-output/planning-artifacts'));
    expect(ctx.paths.implementationArtifacts).toBe(path.join(realProjectRoot, '_bmad-output/implementation-artifacts'));
    expect(ctx.paths.epicsFile).toBe(path.join(realProjectRoot, '_bmad-output/planning-artifacts/epics.md'));
    expect(ctx.paths.sprintStatus).toBe(path.join(realProjectRoot, '_bmad-output/implementation-artifacts/sprint-status.yaml'));
  });

  test('should fail fast by throwing OrchestratorError on missing required environment variables', async () => {
    const incompleteEnv = {
      TARGET_REPO_PATH: realProjectRoot,
    };

    await expect(bootstrapNodeContext(incompleteEnv)).rejects.toThrow(OrchestratorError);
    try {
      await bootstrapNodeContext(incompleteEnv);
    } catch (error: any) {
      expect(error.recoverable).toBe(false);
      expect(error.message).toContain('Missing required environment variables');
    }
  });

  test('should fail fast by throwing OrchestratorError on invalid target repository path', async () => {
    const invalidPathEnv = {
      ...validEnv,
      TARGET_REPO_PATH: path.join(os.tmpdir(), 'non-existent-bmad-dir-' + Date.now()),
    };

    await expect(bootstrapNodeContext(invalidPathEnv)).rejects.toThrow(OrchestratorError);
    try {
      await bootstrapNodeContext(invalidPathEnv);
    } catch (error: any) {
      expect(error.recoverable).toBe(false);
      expect(error.message).toContain('Invalid BMad project');
    }
  });
});
