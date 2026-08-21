import { LLMPort } from './ports/llm-port.js';
import { ExecPort } from './ports/exec-port.js';
import { NotifyPort } from './ports/notify-port.js';
import { HITLPort } from './ports/hitl-port.js';
import { AuditLogger } from '../logging/audit-logger.js';
import { OrchestratorConfig } from '../config/env.js';

export interface NodeContext {
  ports: {
    llm: LLMPort;
    exec: ExecPort;
    notify: NotifyPort;
    hitl: HITLPort;
  };
  paths: {
    planningArtifacts: string;
    implementationArtifacts: string;
    epicsFile: string;
    sprintStatus: string;
    readinessDir: string;
    prdRef: string;
  };
  runId: string;
  logger: AuditLogger;
  config: OrchestratorConfig;
}
