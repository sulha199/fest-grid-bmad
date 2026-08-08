import { WizardDefinition } from './wizard-registry.types';
import { OnboardingApiKeyStep } from '../onboarding/onboarding-api-key-step';
import { OnboardingSubscribeStep } from '../onboarding/onboarding-subscribe-step';

export const wizardRegistry: Record<string, WizardDefinition> = {
  onboarding: {
    key: 'onboarding',
    defaultExitPath: '/',
    steps: [
      { slug: 'api-key', canSkipStep: false, Component: OnboardingApiKeyStep },
      { slug: 'subscribe', canSkipStep: false, Component: OnboardingSubscribeStep },
    ],
  },
};
