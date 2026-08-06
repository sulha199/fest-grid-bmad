export class InvalidUserSettingsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserSettingsInputError';
  }
}

export function validateHidePastEventsAfterDays(value: number): void {
  if (typeof value !== 'number' || isNaN(value) || !Number.isInteger(value) || value < 0 || value > 365) {
    throw new InvalidUserSettingsInputError('hidePastEventsAfterDays must be an integer between 0 and 365 inclusive');
  }
}
