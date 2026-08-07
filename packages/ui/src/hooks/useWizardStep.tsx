'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface WizardStepContextValue {
  isStepCompleted: boolean;
  setStepCompleted: (completed: boolean) => void;
}

const WizardStepContext = createContext<WizardStepContextValue | undefined>(undefined);

export interface WizardStepProviderProps {
  children: ReactNode;
}

/**
 * Provides step completion state to descendants.
 * This is used within individual step content components of a wizard flow.
 */
export function WizardStepProvider({ children }: WizardStepProviderProps) {
  const [isStepCompleted, setStepCompleted] = useState(false);

  return (
    <WizardStepContext.Provider value={{ isStepCompleted, setStepCompleted }}>
      {children}
    </WizardStepContext.Provider>
  );
}

/**
 * Accesses and updates the completion state of the current wizard step.
 * Throws an error if called outside a WizardStepProvider to ensure fail-fast behavior.
 */
export function useWizardStep(): WizardStepContextValue {
  const context = useContext(WizardStepContext);
  if (context === undefined) {
    throw new Error('useWizardStep must be used within a WizardStepProvider');
  }
  return context;
}
