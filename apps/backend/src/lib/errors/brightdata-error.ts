export class BrightDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrightDataError';
  }
}
