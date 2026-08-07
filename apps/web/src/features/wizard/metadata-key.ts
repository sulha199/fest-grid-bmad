function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Generates the expected metadata keys for a given wizard and step.
 * Centralizes the naming convention so consumer stories do not hand-derive it inconsistently.
 * E.g., ('onboarding', 'api-key') => { titleKey: 'wizardOnboardingApiKeyTitle', descriptionKey: 'wizardOnboardingApiKeyDescription' }
 */
export function buildWizardMetadataKeys(
  wizardKey: string,
  stepSlug: string
): { titleKey: string; descriptionKey: string } {
  const pascalWizard = toPascalCase(wizardKey);
  const pascalStep = toPascalCase(stepSlug);

  return {
    titleKey: `wizard${pascalWizard}${pascalStep}Title`,
    descriptionKey: `wizard${pascalWizard}${pascalStep}Description`,
  };
}
