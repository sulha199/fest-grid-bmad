import { HITLPort, HITLPromptOptions } from '../../core/ports/hitl-port.js';

export class FakeHITLPort implements HITLPort {
  private calls: HITLPromptOptions[] = [];
  private responses: (string | Error)[] = [];
  private defaultResponse: string | Error = 'Fake HITL Response';

  public async prompt(options: HITLPromptOptions): Promise<string> {
    this.calls.push({ ...options });

    const nextResponse = this.responses.length > 0 ? this.responses.shift()! : this.defaultResponse;

    if (nextResponse instanceof Error) {
      throw nextResponse;
    }
    return nextResponse;
  }

  public setResponse(response: string | Error): void {
    this.defaultResponse = response;
  }

  public enqueueResponse(response: string | Error): void {
    this.responses.push(response);
  }

  public getCalls(): HITLPromptOptions[] {
    return this.calls;
  }

  public clearCalls(): void {
    this.calls = [];
  }
}
