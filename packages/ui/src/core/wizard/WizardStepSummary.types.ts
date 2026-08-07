export interface WizardStepSummaryItem {
  slug: string;
  title: string;
}

export interface WizardStepSummaryProps {
  steps: WizardStepSummaryItem[];
  currentStepSlug: string;
}
