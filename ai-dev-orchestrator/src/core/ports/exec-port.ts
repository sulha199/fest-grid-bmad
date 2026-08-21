export interface ExecRunOptions {
  cmd: string;
  args: string[];
  cwd?: string;
}

export interface ExecRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ReadFileResult {
  content: string;
  fingerprint: string;
}

export interface ExecPort {
  /**
   * Runs an external shell command with an argv array.
   * Throws OrchestratorError if execution fails or is rejected.
   */
  run(options: ExecRunOptions): Promise<ExecRunResult>;

  /**
   * Reads a file and returns its content with a fingerprint for concurrency control.
   * Throws OrchestratorError if file reading fails.
   */
  readFile(path: string): Promise<ReadFileResult>;

  /**
   * Writes content to a file only if the provided fingerprint matches current state.
   * Throws OrchestratorError (unrecoverable/recoverable) on stale fingerprint or write failures.
   */
  writeIfUnchanged(path: string, content: string, fingerprint: string): Promise<void>;

  /**
   * Gets a list of all file paths written during the current tracking session.
   */
  getWrittenPaths(): string[];

  /**
   * Resets the list of tracked written file paths.
   */
  resetWrittenPaths(): void;
}
