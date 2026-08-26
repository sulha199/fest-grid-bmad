import { WizardDefinition } from './wizard-registry.types';
import { OnboardingApiKeyStep } from '../onboarding/onboarding-api-key-step';
import { OnboardingSubscribeStep } from '../onboarding/onboarding-subscribe-step';
import { OnboardingNotificationStep } from '../onboarding/onboarding-notification-step';

export const wizardRegistry: Record<string, WizardDefinition> = {
  onboarding: {
    key: 'onboarding',
    defaultExitPath: '/posts/select',
    steps: [
      { slug: 'api-key', canSkipStep: false, Component: OnboardingApiKeyStep },
      { slug: 'subscribe', canSkipStep: false, Component: OnboardingSubscribeStep },
      { slug: 'notifications', canSkipStep: true, Component: OnboardingNotificationStep },
    ],
  },
};
