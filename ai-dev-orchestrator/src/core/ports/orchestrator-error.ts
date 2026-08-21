export class OrchestratorError extends Error {
  public readonly recoverable: boolean;
  public override readonly cause?: unknown;

  constructor(message: string, recoverable: boolean, cause?: unknown) {
    super(message);
    this.name = 'OrchestratorError';
    this.recoverable = recoverable;
    this.cause = cause;

    // Ensure the prototype chain is correctly restored
    Object.setPrototypeOf(this, OrchestratorError.prototype);
  }
}
