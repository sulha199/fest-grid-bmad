/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WizardStepProvider, useWizardStep } from './useWizardStep';

afterEach(() => {
  cleanup();
});

// Component to test boundary throwing behavior
function GuardedComponent() {
  useWizardStep();
  return <div>Safe</div>;
}

function ConsumerComponent() {
  const { isStepCompleted, setStepCompleted } = useWizardStep();
  return (
    <div>
      <span data-testid="status">{isStepCompleted ? 'completed' : 'incomplete'}</span>
      <button data-testid="complete-btn" onClick={() => setStepCompleted(true)}>
        Complete
      </button>
    </div>
  );
}

describe('useWizardStep / WizardStepProvider', () => {
  it('throws an error when used outside of a WizardStepProvider', () => {
    // Prevent vitest from printing the expected error stack
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<GuardedComponent />)).toThrow(
      'useWizardStep must be used within a WizardStepProvider'
    );
    
    consoleError.mockRestore();
  });

  it('provides initial isStepCompleted state as false', () => {
    render(
      <WizardStepProvider>
        <ConsumerComponent />
      </WizardStepProvider>
    );
    expect(screen.getByTestId('status')).toHaveTextContent('incomplete');
  });

  it('updates state to completed when setStepCompleted(true) is called', () => {
    render(
      <WizardStepProvider>
        <ConsumerComponent />
      </WizardStepProvider>
    );
    
    expect(screen.getByTestId('status')).toHaveTextContent('incomplete');
    
    act(() => {
      screen.getByTestId('complete-btn').click();
    });
    
    expect(screen.getByTestId('status')).toHaveTextContent('completed');
  });

  it('isolates state between different provider instances and resets on remount', () => {
    const { result, unmount, rerender } = renderHook(() => useWizardStep(), {
      wrapper: ({ children }) => <WizardStepProvider>{children}</WizardStepProvider>,
    });

    expect(result.current.isStepCompleted).toBe(false);

    act(() => {
      result.current.setStepCompleted(true);
    });

    expect(result.current.isStepCompleted).toBe(true);

    // Unmount and remount a fresh provider/hook to prove no cross-instance leakage
    unmount();

    const { result: freshResult } = renderHook(() => useWizardStep(), {
      wrapper: ({ children }) => <WizardStepProvider>{children}</WizardStepProvider>,
    });

    expect(freshResult.current.isStepCompleted).toBe(false);
  });
});
