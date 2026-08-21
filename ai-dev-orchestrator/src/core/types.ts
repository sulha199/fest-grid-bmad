export type ReviewVerdict = 'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN';

export interface Task {
  description: string;
  completed: boolean;
  subtasks?: Task[];
}

export interface Story {
  key: string; // real BMad keys, e.g. "0.2" or "0-2-define-core-types-and-graphstate"
  epicId: string; // real BMad epic key, e.g. "0"
  title: string;
  status: 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done';
  acceptanceCriteria: string[];
  tasks: Task[];
  devNotes?: string;
  autoFixAttempts: number; // SQLite-only, no real-file counterpart
  tag?: 'standard' | 'complex';
  baselineCommit?: string;
}

export interface Epic {
  id: string; // real BMad keys as they appear in epics.md/sprint-status.yaml, e.g. "0"
  title: string;
  stories: Story[];
  status?: 'backlog' | 'in-progress' | 'done';
  readinessReport?: string;
  readinessCheckedAt?: string;
}
