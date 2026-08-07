import React from 'react';

export interface WizardStepDefinition {
  slug: string;
  canSkipStep?: boolean;
  Component: React.ComponentType<any>;
}

export interface WizardDefinition {
  key: string;
  defaultExitPath: string;
  steps: WizardStepDefinition[];
}
