/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WizardNavigation } from './WizardNavigation';

afterEach(() => {
  cleanup();
});
import { WizardNavigationLabels } from './WizardNavigation.types';

describe('WizardNavigation', () => {
  const labels: WizardNavigationLabels = {
    previous: 'Previous',
    next: 'Next',
    skip: 'Skip',
    complete: 'Complete',
  };

  const createProps = (overrides = {}) => {
    return {
      isFirstStep: false,
      isLastStep: false,
      isStepCompleted: true,
      canSkipStep: false,
      labels,
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onSkip: vi.fn(),
      onComplete: vi.fn(),
      ...overrides,
    };
  };

  it('handles first step case: disables Previous', () => {
    const props = createProps({ isFirstStep: true });
    render(<WizardNavigation {...props} />);

    const prevButton = screen.getByRole('button', { name: 'Previous' });
    expect(prevButton).toBeDisabled();
    expect(prevButton).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('handles last step case: shows Complete, hides Next and Skip', () => {
    const props = createProps({ isLastStep: true, canSkipStep: true });
    render(<WizardNavigation {...props} />);

    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();

    const completeButton = screen.getByRole('button', { name: 'Complete' });
    expect(completeButton).not.toBeDisabled();

    const prevButton = screen.getByRole('button', { name: 'Previous' });
    expect(prevButton).not.toBeDisabled();
  });

  it('handles middle step case with canSkipStep: true: shows all 3 buttons', () => {
    const props = createProps({ canSkipStep: true });
    render(<WizardNavigation {...props} />);

    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip' })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
  });

  it('disables Next/Complete when isStepCompleted is false', () => {
    const { rerender } = render(
      <WizardNavigation {...createProps({ isStepCompleted: false, isLastStep: false })} />
    );

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();

    rerender(<WizardNavigation {...createProps({ isStepCompleted: false, isLastStep: true })} />);
    const completeButton = screen.getByRole('button', { name: 'Complete' });
    expect(completeButton).toBeDisabled();
  });

  it('calls callbacks exactly once on button click', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onSkip = vi.fn();
    
    const { rerender } = render(
      <WizardNavigation
        {...createProps({
          canSkipStep: true,
          onPrevious,
          onNext,
          onSkip,
        })}
      />
    );

    screen.getByRole('button', { name: 'Previous' }).click();
    expect(onPrevious).toHaveBeenCalledTimes(1);

    screen.getByRole('button', { name: 'Next' }).click();
    expect(onNext).toHaveBeenCalledTimes(1);

    screen.getByRole('button', { name: 'Skip' }).click();
    expect(onSkip).toHaveBeenCalledTimes(1);

    const onComplete = vi.fn();
    rerender(
      <WizardNavigation
        {...createProps({
          isLastStep: true,
          onComplete,
        })}
      />
    );

    screen.getByRole('button', { name: 'Complete' }).click();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
