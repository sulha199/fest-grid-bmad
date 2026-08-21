export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
}

export interface LLMCompleteOptions {
  role: string;
  systemPrompt: string;
  messages: LLMMessage[];
}

export interface LLMPort {
  /**
   * Completes a chat prompt using the specified node role.
   * Resolves with the text completion from the model.
   * Throws OrchestratorError if a recoverable/unrecoverable LLM call failure occurs.
   */
  complete(options: LLMCompleteOptions): Promise<string>;
}
