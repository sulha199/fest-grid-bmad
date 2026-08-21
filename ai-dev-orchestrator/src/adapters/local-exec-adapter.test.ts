import '../config/setup-test-env.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { LocalExecAdapter } from './local-exec-adapter.js';
import { OrchestratorError } from '../core/ports/orchestrator-error.js';
import { OrchestratorConfig } from '../config/env.js';

describe('LocalExecAdapter Integration Tests', () => {
  let tempRepoPath: string;
  let mockConfig: OrchestratorConfig;
  let adapter: LocalExecAdapter;

  beforeEach(async () => {
    // Create a real temporary directory for target repository
    tempRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'bmad-test-repo-'));
    // Ensure the temp directory path is fully resolved and matches target system separators
    tempRepoPath = path.resolve(tempRepoPath);

    mockConfig = {
      NINE_ROUTER_BASE_URL: 'http://localhost:20128/v1',
      NINE_ROUTER_API_KEY: 'test-api-key',
      ORCH_MODEL_PLANNER: 'planner-alias',
      ORCH_MODEL_COMPLEX: 'complex-alias',
      ORCH_MODEL_SPEED: 'speed-alias',
      ORCH_MODEL_TESTER: 'tester-alias',
      TARGET_REPO_PATH: tempRepoPath,
      HITL_NOTIFY_EMAIL: 'test@example.com',
      HITL_TIMEOUT_MS: 300000,
      MAX_AUTO_FIX_ATTEMPTS: 1,
      RESEND_API_KEY: 'resend-key',
      EXEC_TIMEOUT_MS: 600000, // 10 minutes default
    };

    adapter = new LocalExecAdapter(mockConfig);
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempRepoPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures
    }
  });

  it('should run a real trivial command and return stdout, stderr, and exit code 0', async () => {
    const result = await adapter.run({
      cmd: 'node',
      args: ['-e', 'console.log("hello from node")'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello from node');
    expect(result.stderr.trim()).toBe('');
  });

  it('should run a real failing command and return non-zero exit code', async () => {
    const result = await adapter.run({
      cmd: 'node',
      args: ['-e', 'process.exit(42)'],
    });

    expect(result.exitCode).toBe(42);
  });

  it('should throw unrecoverable OrchestratorError if command does not exist or fails to spawn', async () => {
    await expect(
      adapter.run({
        cmd: 'non-existent-command-12345',
        args: [],
      })
    ).rejects.toThrowError(/Failed to spawn process/);

    try {
      await adapter.run({
        cmd: 'non-existent-command-12345',
        args: [],
      });
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.recoverable).toBe(false);
    }
  });

  it('should timeout a hung command and throw recoverable OrchestratorError', async () => {
    // Create an adapter with a very short timeout
    const fastTimeoutConfig = {
      ...mockConfig,
      EXEC_TIMEOUT_MS: 50, // 50ms timeout
    };
    const fastAdapter = new LocalExecAdapter(fastTimeoutConfig);

    await expect(
      fastAdapter.run({
        cmd: 'node',
        args: ['-e', 'setTimeout(() => {}, 2000)'],
      })
    ).rejects.toThrowError(/timed out/);

    try {
      await fastAdapter.run({
        cmd: 'node',
        args: ['-e', 'setTimeout(() => {}, 2000)'],
      });
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.recoverable).toBe(true);
    }
  });

  it('should reject call with unrecoverable OrchestratorError if cwd would resolve outside TARGET_REPO_PATH', async () => {
    // Absolute path outside TARGET_REPO_PATH
    const outsidePath = path.resolve(tempRepoPath, '..');

    await expect(
      adapter.run({
        cmd: 'node',
        args: ['-v'],
        cwd: outsidePath,
      })
    ).rejects.toThrowError(/Path traversal escape detected/);

    // Relative path outside TARGET_REPO_PATH
    await expect(
      adapter.run({
        cmd: 'node',
        args: ['-v'],
        cwd: '..',
      })
    ).rejects.toThrowError(/Path traversal escape detected/);
  });

  it('should reject call with unrecoverable OrchestratorError if a file-path argument would resolve outside TARGET_REPO_PATH', async () => {
    // Traversal inside an argument
    await expect(
      adapter.run({
        cmd: 'node',
        args: ['../escaped-file.txt'],
      })
    ).rejects.toThrowError(/Path traversal escape detected in argument/);

    // Key-value traversal inside an argument
    await expect(
      adapter.run({
        cmd: 'node',
        args: ['--output=../../escaped-file.txt'],
      })
    ).rejects.toThrowError(/Path traversal escape detected in argument/);
  });

  it('should read a file, return content + fingerprint, and boundary check against TARGET_REPO_PATH', async () => {
    const filePath = 'test-file.txt';
    const absPath = path.join(tempRepoPath, filePath);
    const expectedContent = 'hello world';
    await fs.writeFile(absPath, expectedContent, 'utf8');

    const result = await adapter.readFile(filePath);
    expect(result.content).toBe(expectedContent);
    expect(result.fingerprint).toBeTruthy();
    expect(typeof result.fingerprint).toBe('string');

    // Test path boundary check on readFile
    await expect(
      adapter.readFile('../escaped-file.txt')
    ).rejects.toThrowError(/Path traversal escape detected/);
  });

  it('should write file if unchanged, track written paths, and detect external changes', async () => {
    const filePath = 'concurrency-file.txt';
    const content1 = 'original content';
    const content2 = 'updated content';

    // 1. Initial write
    await adapter.writeFile(filePath, content1);
    expect(adapter.getWrittenPaths()).toContain(path.join(tempRepoPath, filePath));

    // 2. Read to get current fingerprint
    const readResult = await adapter.readFile(filePath);
    expect(readResult.content).toBe(content1);

    // 3. Write via writeIfUnchanged (success)
    await adapter.writeIfUnchanged(filePath, content2, readResult.fingerprint);
    const readResult2 = await adapter.readFile(filePath);
    expect(readResult2.content).toBe(content2);

    // 4. External write (simulates another process modifying the file)
    const absPath = path.join(tempRepoPath, filePath);
    // Add brief sleep to guarantee mtimeMs change if filesystem precision is low
    await new Promise((resolve) => setTimeout(resolve, 10));
    await fs.writeFile(absPath, 'external edit', 'utf8');

    // 5. Try to write with stale fingerprint (should fail)
    await expect(
      adapter.writeIfUnchanged(filePath, 'stale write attempt', readResult2.fingerprint)
    ).rejects.toThrowError('external change detected');

    try {
      await adapter.writeIfUnchanged(filePath, 'stale write attempt', readResult2.fingerprint);
    } catch (err: any) {
      expect(err).toBeInstanceOf(OrchestratorError);
      expect(err.recoverable).toBe(false);
    }
  });

  it('should correctly scope tracked written paths across two sequential stories', async () => {
    const file1 = 'story1-file.txt';
    const file2 = 'story2-file.txt';

    // Story 1 writes file1
    await adapter.writeFile(file1, 'story 1 content');
    expect(adapter.getWrittenPaths()).toContain(path.join(tempRepoPath, file1));
    expect(adapter.getWrittenPaths()).not.toContain(path.join(tempRepoPath, file2));

    // Reset for next story
    adapter.resetWrittenPaths();
    expect(adapter.getWrittenPaths()).toEqual([]);

    // Story 2 writes file2
    await adapter.writeFile(file2, 'story 2 content');
    expect(adapter.getWrittenPaths()).toContain(path.join(tempRepoPath, file2));
    expect(adapter.getWrittenPaths()).not.toContain(path.join(tempRepoPath, file1));
  });
});
