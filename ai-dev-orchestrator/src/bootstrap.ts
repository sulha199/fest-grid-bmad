import * as path from 'node:path';
import { NodeContext } from './core/node-context.js';
import { parseConfig } from './config/env.js';
import { resolveBMadProject } from './core/bmad-artifacts/project-resolver.js';
import { NineRouterLLMAdapter } from './adapters/nine-router-llm-adapter.js';
import { LocalExecAdapter } from './adapters/local-exec-adapter.js';
import { AuditLogger } from './logging/audit-logger.js';
import { OrchestratorError } from './core/ports/orchestrator-error.js';
import { NotifyPort } from './core/ports/notify-port.js';
import { HITLPort } from './core/ports/hitl-port.js';

const dummyNotifyPort: NotifyPort = {
  async send(): Promise<void> {}
};

const dummyHITLPort: HITLPort = {
  async prompt(): Promise<string> {
    return '';
  }
};

/**
 * Bootstraps the orchestrator application context.
 * Loads config, validates project, constructs adapters and logger, and returns the assembled NodeContext.
 */
export async function bootstrapNodeContext(env: Record<string, string | undefined> = process.env): Promise<NodeContext> {
  let parsedConfig;
  try {
    parsedConfig = parseConfig(env);
  } catch (error: any) {
    if (error instanceof OrchestratorError) {
      throw error;
    }
    throw new OrchestratorError(error.message || 'Environment validation failed', false, error);
  }

  let project;
  try {
    project = resolveBMadProject(parsedConfig.TARGET_REPO_PATH);
  } catch (error: any) {
    if (error instanceof OrchestratorError) {
      throw error;
    }
    throw new OrchestratorError(error.message || 'Project resolution failed', false, error);
  }

  // Construct real adapters
  const llm = new NineRouterLLMAdapter(parsedConfig);
  const exec = new LocalExecAdapter(parsedConfig);

  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const logDir = path.join(project.targetRepoPath, 'logs');
  const logger = new AuditLogger(runId, { logDir });

  const paths = {
    planningArtifacts: project.planningArtifacts,
    implementationArtifacts: project.implementationArtifacts,
    epicsFile: path.join(project.planningArtifacts, 'epics.md'),
    sprintStatus: path.join(project.implementationArtifacts, 'sprint-status.yaml'),
    readinessDir: path.join(project.planningArtifacts, 'readiness'),
    prdRef: project.prdPath || '',
  };

  return {
    ports: {
      llm,
      exec,
      notify: dummyNotifyPort,
      hitl: dummyHITLPort,
    },
    paths,
    runId,
    logger,
    config: parsedConfig,
  };
}
