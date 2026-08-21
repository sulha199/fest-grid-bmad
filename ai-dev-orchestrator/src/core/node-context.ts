import { LLMPort } from './ports/llm-port.js';
import { ExecPort } from './ports/exec-port.js';
import { NotifyPort } from './ports/notify-port.js';
import { HITLPort } from './ports/hitl-port.js';
import { AuditLogger } from '../logging/audit-logger.js';
import { OrchestratorConfig } from '../config/env.js';
import { GraphState } from './state.js';

/**
 * Node function type representing a graph node process function.
 * Receives the GraphState and returns a Promise resolving to a partial representation of the new GraphState.
 */
export type NodeFunction = (state: GraphState) => Promise<Partial<GraphState>>;

/**
 * Node factory function type.
 * Receives the NodeContext dependency wrapper and returns a NodeFunction.
 * By using this pattern, nodes resolve all their port, path, and logging dependencies
 * via closure over NodeContext at graph-construction time, rather than reaching for global resources.
 * 
 * Example usage:
 * ```ts
 * export const createPlannerNode = (ctx: NodeContext): NodeFunction => {
 *   return async (state: GraphState): Promise<Partial<GraphState>> => {
 *     // Use ctx.ports.llm, ctx.logger, etc.
 *     return { error_status: 'ok' };
 *   };
 * };
 * ```
 */
export type NodeFactory = (ctx: NodeContext) => NodeFunction;

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
