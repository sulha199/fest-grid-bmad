import { WizardDefinition } from './wizard-registry.types';

/**
 * Empty, typed wizard registry.
 *
 * RESERVED-SLOT PATTERN:
 * This registry is intentionally shipped empty here.
 * The first real wizard consumer (Story 3.1, 'onboarding') will add its entry here
 * using the shape defined in wizard-registry.types.ts:
 *
 * Example (verbatim from Story 3.1's Task 4):
 * export const wizardRegistry: Record<string, WizardDefinition> = {
 *   onboarding: {
 *     key: 'onboarding',
 *     defaultExitPath: '/settings/subscriptions',
 *     steps: [
 *       { slug: 'api-key', Component: OnboardingApiKeyStep },
 *       { slug: 'subscribe', Component: OnboardingSubscribeStep }
 *     ]
 *   }
 * };
 */
export const wizardRegistry: Record<string, WizardDefinition> = {};
