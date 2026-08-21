import { describe, test, expect, vi } from 'vitest';
import { NodeContext, NodeFactory, NodeFunction } from './node-context.js';
import { GraphState } from './state.js';
import { FakeLLMPort, FakeExecPort, FakeNotifyPort, FakeHITLPort } from '../adapters/fakes/index.js';
import { AuditLogger } from '../logging/audit-logger.js';
import { OrchestratorConfig } from '../config/env.js';

describe('NodeContext & Dependency Injection Pattern', () => {
  test('should construct a node using NodeContext and closure, only calling injected fake ports', async () => {
    // 1. Arrange fakes and mocks
    const fakeLlm = new FakeLLMPort();
    const fakeExec = new FakeExecPort();
    const fakeNotify = new FakeNotifyPort();
    const fakeHitl = new FakeHITLPort();

    // Create a mock audit logger and config
    const mockLogger = {
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as AuditLogger;

    const mockConfig = {
      NINE_ROUTER_API_KEY: 'test-key',
      ORCH_MODEL_PLANNER: 'planner',
      ORCH_MODEL_COMPLEX: 'complex',
      ORCH_MODEL_SPEED: 'speed',
      ORCH_MODEL_TESTER: 'tester',
      TARGET_REPO_PATH: '/mock/repo',
    } as unknown as OrchestratorConfig;

    const fakeCtx: NodeContext = {
      ports: {
        llm: fakeLlm,
        exec: fakeExec,
        notify: fakeNotify,
        hitl: fakeHitl,
      },
      paths: {
        planningArtifacts: '/mock/repo/_bmad-output/planning-artifacts',
        implementationArtifacts: '/mock/repo/_bmad-output/implementation-artifacts',
        epicsFile: '/mock/repo/_bmad-output/planning-artifacts/epics.md',
        sprintStatus: '/mock/repo/_bmad-output/implementation-artifacts/sprint-status.yaml',
        readinessDir: '/mock/repo/_bmad-output/planning-artifacts/readiness',
        prdRef: '/mock/repo/_bmad-output/planning-artifacts/prds/prd.md',
      },
      runId: 'run-123',
      logger: mockLogger,
      config: mockConfig,
    };

    // 2. Define a mock NodeFactory adhering to the NodeFactory / createPlannerNode signature
    const createTestNode: NodeFactory = (ctx: NodeContext): NodeFunction => {
      return async (state: GraphState): Promise<Partial<GraphState>> => {
        // Must only use dependencies from the closed over NodeContext
        const promptResult = await ctx.ports.llm.complete({
          systemPrompt: 'System',
          userPrompt: `Current spec is: ${state.spec}`,
          model: ctx.config.ORCH_MODEL_PLANNER,
        });

        await ctx.ports.exec.run({ cmd: 'run-test-cmd', args: [] });
        await ctx.ports.notify.send({
          to: 'test@example.com',
          subject: 'Task started',
          body: 'The task has started successfully',
        });

        ctx.logger.child({ step: 'test' });

        return {
          current_code: promptResult,
          error_status: 'ok',
        };
      };
    };

    // 3. Act
    const nodeFunc = createTestNode(fakeCtx);
    const initialState: GraphState = {
      spec: '/mock/repo/_bmad-output/planning-artifacts/prds/prd.md',
      tasks_queue: [],
      current_code: null,
      terminal_output: null,
      error_status: null,
      human_feedback: null,
    };

    fakeLlm.setResponse('Completed code');
    const result = await nodeFunc(initialState);

    // 4. Assert
    // Check that the returned state modifications are correct
    expect(result.current_code).toBe('Completed code');
    expect(result.error_status).toBe('ok');

    // Assert that the fake adapters were actually invoked exactly as expected
    expect(fakeLlm.getCalls()).toHaveLength(1);
    expect(fakeLlm.getCalls()[0]).toEqual({
      systemPrompt: 'System',
      userPrompt: `Current spec is: ${initialState.spec}`,
      model: mockConfig.ORCH_MODEL_PLANNER,
    });

    expect(fakeExec.getRunCalls()).toHaveLength(1);
    expect(fakeExec.getRunCalls()[0]).toEqual({
      cmd: 'run-test-cmd',
      args: [],
    });

    expect(fakeNotify.getCalls()).toHaveLength(1);
    expect(fakeNotify.getCalls()[0]).toEqual({
      to: 'test@example.com',
      subject: 'Task started',
      body: 'The task has started successfully',
    });

    expect(mockLogger.child).toHaveBeenCalledWith({ step: 'test' });
  });
});
