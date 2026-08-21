import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AuditLogger } from './audit-logger.js';

const testLogDir = path.join(process.cwd(), 'temp-test-logs');

describe('AuditLogger', () => {
  beforeAll(async () => {
    // Clean up test directory if it exists
    await fs.rm(testLogDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    // Clean up test directory after tests run
    await fs.rm(testLogDir, { recursive: true, force: true });
  });

  test('throws an error if runId is empty', () => {
    expect(() => new AuditLogger('')).toThrow('runId is required for AuditLogger');
  });

  test('creates the log directory and files automatically and appends logs sequentially', async () => {
    const runId = 'test-run-123';
    const logger = new AuditLogger(runId, { logDir: testLogDir });

    // Assert file path format
    expect(logger.getLogFilePath()).toBe(path.join(testLogDir, 'test-run-123.jsonl'));

    // Perform sequential log calls
    await logger.log('LLM_CALL', { prompt: 'Who is Winston?', response: 'The architect.' });
    await logger.log('SHELL_COMMAND', { command: 'pnpm test', status: 0 });

    const logFileContent = await fs.readFile(logger.getLogFilePath(), 'utf8');
    const lines = logFileContent.trim().split('\n');

    expect(lines.length).toBe(2);

    // Verify first line
    const entry1 = JSON.parse(lines[0]);
    expect(entry1.runId).toBe(runId);
    expect(entry1.event).toBe('LLM_CALL');
    expect(entry1.prompt).toBe('Who is Winston?');
    expect(entry1.response).toBe('The architect.');
    expect(entry1.ts).toBeDefined();
    // Validate ISO timestamp
    expect(new Date(entry1.ts).getTime()).not.toBeNaN();

    // Verify second line
    const entry2 = JSON.parse(lines[1]);
    expect(entry2.runId).toBe(runId);
    expect(entry2.event).toBe('SHELL_COMMAND');
    expect(entry2.command).toBe('pnpm test');
    expect(entry2.status).toBe(0);
    expect(entry2.ts).toBeDefined();

    // Verify ordering of timestamps
    expect(new Date(entry2.ts).getTime()).toBeGreaterThanOrEqual(new Date(entry1.ts).getTime());
  });
});
