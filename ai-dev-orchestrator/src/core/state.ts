import { Epic } from './types.js';

export interface GraphState {
  spec: string;                 // path to the target project's PRD (resolved above) — top of the real BMad document hierarchy this run decomposes from
  tasks_queue: Epic[];          // a FRESH in-memory parse of epics.md + sprint-status.yaml + any already-materialized story files for the epic in play — re-read as needed, never itself durable
  current_code: string | null;  // the story's cumulative diff so far (grows across AUTO_FIX rounds, not just the latest patch); Tier-2 reviews this field verbatim, never re-derives via ExecPort
  terminal_output: string | null;
  error_status: "ok" | "auto_fixed" | "needs_human" | null;
  human_feedback: string | null;
}
