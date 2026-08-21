import { expectTypeOf, test, describe } from 'vitest';
import { GraphState } from './state.js';
import { Epic, Story, ReviewVerdict, Task } from './types.js';

describe('GraphState Type Assertions', () => {
  test('GraphState has exactly the six required fields with correct types', () => {
    expectTypeOf<GraphState>().toEqualTypeOf<{
      spec: string;
      tasks_queue: Epic[];
      current_code: string | null;
      terminal_output: string | null;
      error_status: "ok" | "auto_fixed" | "needs_human" | null;
      human_feedback: string | null;
    }>();
  });
});

describe('Core Types Assertions', () => {
  test('ReviewVerdict is strictly defined', () => {
    expectTypeOf<ReviewVerdict>().toEqualTypeOf<'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN'>();
  });

  test('Story type matches the required schema', () => {
    expectTypeOf<Story>().toMatchTypeOf<{
      key: string;
      epicId: string;
      title: string;
      status: 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done';
      acceptanceCriteria: string[];
      tasks: Task[];
      devNotes?: string;
      autoFixAttempts: number;
      tag?: 'standard' | 'complex';
      baselineCommit?: string;
    }>();
  });

  test('Epic type matches the required schema', () => {
    expectTypeOf<Epic>().toMatchTypeOf<{
      id: string;
      title: string;
      stories: Story[];
      status?: 'backlog' | 'in-progress' | 'done';
      readinessReport?: string;
      readinessCheckedAt?: string;
    }>();
  });
});
