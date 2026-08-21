import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface AuditLogEntry {
  ts: string;
  runId: string;
  event: string;
  [key: string]: unknown;
}

export interface AuditLoggerOptions {
  logDir?: string;
}

export class AuditLogger {
  private readonly runId: string;
  private readonly logFilePath: string;

  constructor(runId: string, options: AuditLoggerOptions = {}) {
    if (!runId) {
      throw new Error('runId is required for AuditLogger');
    }
    this.runId = runId;
    const logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.logFilePath = path.join(logDir, `${runId}.jsonl`);
  }

  async log(event: string, extra: Record<string, unknown> = {}): Promise<void> {
    const entry: AuditLogEntry = {
      ts: new Date().toISOString(),
      runId: this.runId,
      event,
      ...extra,
    };

    const logLine = JSON.stringify(entry) + '\n';
    
    // Ensure parent directory exists
    const dir = path.dirname(this.logFilePath);
    await fs.mkdir(dir, { recursive: true });

    // Append to file
    await fs.appendFile(this.logFilePath, logLine, 'utf8');
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}
