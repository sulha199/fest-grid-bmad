import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { ExecPort, ExecRunOptions, ExecRunResult, ReadFileResult } from '../core/ports/exec-port.js';
import { OrchestratorError } from '../core/ports/orchestrator-error.js';
import { OrchestratorConfig, config as defaultConfig } from '../config/index.js';

export class LocalExecAdapter implements ExecPort {
  private readonly config: OrchestratorConfig;
  private readonly writtenPaths = new Set<string>();

  constructor(config: OrchestratorConfig = defaultConfig) {
    this.config = config;
  }

  private resolveAndCheckPath(filePath: string): string {
    const resolvedTarget = path.resolve(this.config.TARGET_REPO_PATH);
    const resolvedPath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(resolvedTarget, filePath);

    const relative = path.relative(resolvedTarget, resolvedPath);
    const isEscaped = relative.startsWith('..') || path.isAbsolute(relative);

    if (isEscaped) {
      throw new OrchestratorError(
        `Path traversal escape detected: "${filePath}" resolves outside "${this.config.TARGET_REPO_PATH}"`,
        false
      );
    }
    return resolvedPath;
  }

  async run(options: ExecRunOptions): Promise<ExecRunResult> {
    const resolvedCwd = options.cwd
      ? this.resolveAndCheckPath(options.cwd)
      : path.resolve(this.config.TARGET_REPO_PATH);

    // Escape check on arguments
    for (const arg of options.args) {
      if (path.isAbsolute(arg)) {
        // Absolute paths must resolve inside the target repo
        this.resolveAndCheckPath(arg);
      } else if (arg.includes('..') || arg.startsWith('.')) {
        // Check if relative path components escape the target repo
        const parts = arg.split('=');
        const value = parts[1] || parts[0];
        if (value.includes('..') || path.isAbsolute(value)) {
          const potentialPath = path.resolve(resolvedCwd, value);
          const resolvedTarget = path.resolve(this.config.TARGET_REPO_PATH);
          const relative = path.relative(resolvedTarget, potentialPath);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new OrchestratorError(
              `Path traversal escape detected in argument: "${arg}" resolves outside "${this.config.TARGET_REPO_PATH}"`,
              false
            );
          }
        }
      }
    }

    const timeout = this.config.EXEC_TIMEOUT_MS;
    let timeoutId: NodeJS.Timeout | undefined;
    let killedDueToTimeout = false;

    return new Promise<ExecRunResult>((resolve, reject) => {
      const proc = spawn(options.cmd, options.args, {
        cwd: resolvedCwd,
        shell: false,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(
          new OrchestratorError(
            `Failed to spawn process "${options.cmd}": ${err.message}`,
            false,
            err
          )
        );
      });

      proc.on('close', (code, _signal) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (killedDueToTimeout) {
          reject(
            new OrchestratorError(
              `Command "${options.cmd}" timed out after ${timeout}ms`,
              true
            )
          );
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          killedDueToTimeout = true;
          proc.kill('SIGKILL');
        }, timeout);
      }
    });
  }

  async readFile(filePath: string): Promise<ReadFileResult> {
    try {
      const resolvedPath = this.resolveAndCheckPath(filePath);
      const content = await fs.readFile(resolvedPath, 'utf8');
      const stat = await fs.stat(resolvedPath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const fingerprint = `${stat.mtimeMs}-${hash}`;
      return { content, fingerprint };
    } catch (error: any) {
      if (error instanceof OrchestratorError) {
        throw error;
      }
      throw new OrchestratorError(
        `Failed to read file "${filePath}": ${error.message}`,
        false,
        error
      );
    }
  }

  async writeIfUnchanged(
    filePath: string,
    content: string,
    fingerprint: string
  ): Promise<void> {
    try {
      const resolvedPath = this.resolveAndCheckPath(filePath);

      let currentFingerprint = '';
      try {
        const currentContent = await fs.readFile(resolvedPath, 'utf8');
        const stat = await fs.stat(resolvedPath);
        const hash = crypto.createHash('sha256').update(currentContent).digest('hex');
        currentFingerprint = `${stat.mtimeMs}-${hash}`;
      } catch (readError: any) {
        if (readError.code !== 'ENOENT') {
          throw new OrchestratorError(
            `Failed to read existing file for fingerprint verification: ${readError.message}`,
            false,
            readError
          );
        }
      }

      if (currentFingerprint !== fingerprint) {
        throw new OrchestratorError('external change detected', false);
      }

      await fs.writeFile(resolvedPath, content, 'utf8');
      this.writtenPaths.add(resolvedPath);
    } catch (error: any) {
      if (error instanceof OrchestratorError) {
        throw error;
      }
      throw new OrchestratorError(
        `Failed to write file "${filePath}": ${error.message}`,
        false,
        error
      );
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const resolvedPath = this.resolveAndCheckPath(filePath);
      await fs.writeFile(resolvedPath, content, 'utf8');
      this.writtenPaths.add(resolvedPath);
    } catch (error: any) {
      if (error instanceof OrchestratorError) {
        throw error;
      }
      throw new OrchestratorError(
        `Failed to write file "${filePath}": ${error.message}`,
        false,
        error
      );
    }
  }

  getWrittenPaths(): string[] {
    return Array.from(this.writtenPaths);
  }

  resetWrittenPaths(): void {
    this.writtenPaths.clear();
  }
}
