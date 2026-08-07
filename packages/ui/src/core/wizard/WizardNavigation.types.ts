export interface WizardNavigationLabels {
  previous: string;
  next: string;
  skip: string;
  complete: string;
}

export interface WizardNavigationProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  isStepCompleted: boolean;
  canSkipStep: boolean;
  labels: WizardNavigationLabels;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}
