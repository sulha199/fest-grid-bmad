export interface NotifySendOptions {
  to: string;
  subject: string;
  body: string;
}

export interface NotifyPort {
  /**
   * Sends a notification message.
   * Throws OrchestratorError if sending fails.
   */
  send(options: NotifySendOptions): Promise<void>;
}
