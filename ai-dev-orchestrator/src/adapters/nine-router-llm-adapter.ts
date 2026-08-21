import { OpenAI } from 'openai';
import { LLMPort, LLMCompleteOptions } from '../core/ports/llm-port.js';
import { OrchestratorError } from '../core/ports/orchestrator-error.js';
import { OrchestratorConfig, config as defaultConfig } from '../config/index.js';

export class NineRouterLLMAdapter implements LLMPort {
  private readonly client: OpenAI;
  private readonly config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = defaultConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: this.config.NINE_ROUTER_BASE_URL,
      apiKey: this.config.NINE_ROUTER_API_KEY,
    });
  }

  async complete(options: LLMCompleteOptions): Promise<string> {
    const roleLower = options.role.toLowerCase();
    let modelAlias: string;

    if (roleLower === 'planner') {
      modelAlias = this.config.ORCH_MODEL_PLANNER;
    } else if (roleLower === 'complex') {
      modelAlias = this.config.ORCH_MODEL_COMPLEX;
    } else if (roleLower === 'speed') {
      modelAlias = this.config.ORCH_MODEL_SPEED;
    } else if (roleLower === 'tester') {
      modelAlias = this.config.ORCH_MODEL_TESTER;
    } else {
      throw new OrchestratorError(`Unsupported LLM role: "${options.role}"`, false);
    }

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    for (const msg of options.messages) {
      openaiMessages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      });
    }

    try {
      const response = await this.client.chat.completions.create({
        model: modelAlias,
        messages: openaiMessages,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      const status = error?.status;
      if (status === 401 || status === 403) {
        throw new OrchestratorError(
          `OpenAI Authentication/Authorization failed: ${error.message || 'Unauthorized'}`,
          false,
          error
        );
      }

      // For network/5xx or any other error, determine recoverability.
      // 5xx (>= 500) and network errors (status is undefined/null) are recoverable.
      const isRecoverable = !status || status >= 500 || status === 429;
      throw new OrchestratorError(
        `OpenAI API call failed: ${error.message || String(error)}`,
        isRecoverable,
        error
      );
    }
  }
}
