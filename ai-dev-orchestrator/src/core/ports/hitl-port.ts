export interface HITLPromptOptions {
  summary: string;
  expand?: string;
}

export interface HITLPort {
  /**
   * Prompts the human-in-the-loop for input or guidance.
   * Resolves with the human's string response.
   * Throws OrchestratorError if prompt fails or is interrupted.
   */
  prompt(options: HITLPromptOptions): Promise<string>;
}
