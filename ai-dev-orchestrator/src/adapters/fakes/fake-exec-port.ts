import { ExecPort, ExecRunOptions, ExecRunResult, ReadFileResult } from '../../core/ports/exec-port.js';
import { OrchestratorError } from '../../core/ports/orchestrator-error.js';

export class FakeExecPort implements ExecPort {
  private runCalls: ExecRunOptions[] = [];
  private readFileCalls: string[] = [];
  private writeCalls: { path: string; content: string; fingerprint: string }[] = [];

  private files = new Map<string, { content: string; fingerprint: string }>();
  private writtenPaths: string[] = [];

  private defaultRunResult: ExecRunResult | Error = { stdout: '', stderr: '', exitCode: 0 };
  private runResultsQueue: (ExecRunResult | Error)[] = [];
  private runResultsByCmd = new Map<string, ExecRunResult | Error>();

  public async run(options: ExecRunOptions): Promise<ExecRunResult> {
    this.runCalls.push({ ...options });

    let result = this.runResultsByCmd.get(options.cmd);
    if (result === undefined) {
      result = this.runResultsQueue.length > 0 ? this.runResultsQueue.shift()! : this.defaultRunResult;
    }

    if (result instanceof Error) {
      throw result;
    }
    return result;
  }

  public async readFile(path: string): Promise<ReadFileResult> {
    this.readFileCalls.push(path);

    const file = this.files.get(path);
    if (!file) {
      throw new OrchestratorError(`File not found: ${path}`, true);
    }
    return file;
  }

  public async writeIfUnchanged(path: string, content: string, fingerprint: string): Promise<void> {
    this.writeCalls.push({ path, content, fingerprint });

    const file = this.files.get(path);
    if (file && file.fingerprint !== fingerprint) {
      throw new OrchestratorError(`Fingerprint mismatch for ${path}: expected ${file.fingerprint}, got ${fingerprint}`, true);
    }

    const nextFingerprint = (Number(fingerprint) + 1).toString();
    this.files.set(path, { content, fingerprint: isNaN(Number(fingerprint)) ? 'next-fingerprint' : nextFingerprint });
    if (!this.writtenPaths.includes(path)) {
      this.writtenPaths.push(path);
    }
  }

  public getWrittenPaths(): string[] {
    return this.writtenPaths;
  }

  public resetWrittenPaths(): void {
    this.writtenPaths = [];
  }

  // Helper/Assertion API
  public setFile(path: string, content: string, fingerprint = '1'): void {
    this.files.set(path, { content, fingerprint });
  }

  public getFile(path: string): { content: string; fingerprint: string } | undefined {
    return this.files.get(path);
  }

  public setRunResult(result: ExecRunResult | Error): void {
    this.defaultRunResult = result;
  }

  public enqueueRunResult(result: ExecRunResult | Error): void {
    this.runResultsQueue.push(result);
  }

  public setRunResultForCmd(cmd: string, result: ExecRunResult | Error): void {
    this.runResultsByCmd.set(cmd, result);
  }

  public getRunCalls(): ExecRunOptions[] {
    return this.runCalls;
  }

  public getReadFileCalls(): string[] {
    return this.readFileCalls;
  }

  public getWriteCalls(): { path: string; content: string; fingerprint: string }[] {
    return this.writeCalls;
  }

  public clearCalls(): void {
    this.runCalls = [];
    this.readFileCalls = [];
    this.writeCalls = [];
  }
}
