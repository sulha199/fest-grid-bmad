import { describe, it, expect } from 'vitest';
import { buildWizardMetadataKeys } from './metadata-key';

describe('buildWizardMetadataKeys', () => {
  it('handles single-word keys', () => {
    const keys = buildWizardMetadataKeys('onboarding', 'subscribe');
    expect(keys).toEqual({
      titleKey: 'wizardOnboardingSubscribeTitle',
      descriptionKey: 'wizardOnboardingSubscribeDescription',
    });
  });

  it('handles hyphenated keys (kebab-case)', () => {
    const keys = buildWizardMetadataKeys('api-key-wizard', 'api-key');
    expect(keys).toEqual({
      titleKey: 'wizardApiKeyWizardApiKeyTitle',
      descriptionKey: 'wizardApiKeyWizardApiKeyDescription',
    });
  });
});
