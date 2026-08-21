import { NotifyPort, NotifySendOptions } from '../../core/ports/notify-port.js';
import { OrchestratorError } from '../../core/ports/orchestrator-error.js';

export class FakeNotifyPort implements NotifyPort {
  private calls: NotifySendOptions[] = [];
  private failureCount = 0;
  private currentFailures = 0;

  public async send(options: NotifySendOptions): Promise<void> {
    this.calls.push({ ...options });

    if (this.currentFailures < this.failureCount) {
      this.currentFailures++;
      throw new OrchestratorError(`Simulated notification failure (${this.currentFailures}/${this.failureCount})`, true);
    }
  }

  public setFailureCount(count: number): void {
    this.failureCount = count;
    this.currentFailures = 0;
  }

  public getCalls(): NotifySendOptions[] {
    return this.calls;
  }

  public clearCalls(): void {
    this.calls = [];
    this.currentFailures = 0;
  }
}
