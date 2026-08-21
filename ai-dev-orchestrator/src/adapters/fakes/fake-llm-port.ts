import { LLMPort, LLMCompleteOptions } from '../../core/ports/llm-port.js';

export class FakeLLMPort implements LLMPort {
  private calls: LLMCompleteOptions[] = [];
  private responses: (string | Error)[] = [];
  private defaultResponse: string | Error = 'Fake LLM Response';

  public async complete(options: LLMCompleteOptions): Promise<string> {
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

  public getCalls(): LLMCompleteOptions[] {
    return this.calls;
  }

  public clearCalls(): void {
    this.calls = [];
  }
}
