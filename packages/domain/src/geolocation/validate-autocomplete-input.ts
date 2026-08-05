export const MIN_AUTOCOMPLETE_INPUT_LENGTH = 3;

export function meetsAutocompleteInputThreshold(input: string): boolean {
  return input.trim().length >= MIN_AUTOCOMPLETE_INPUT_LENGTH;
}
