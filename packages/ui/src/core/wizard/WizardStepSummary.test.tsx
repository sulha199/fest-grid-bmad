/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WizardStepSummary } from './WizardStepSummary';
import { WizardStepSummaryItem } from './WizardStepSummary.types';

describe('WizardStepSummary', () => {
  const steps: WizardStepSummaryItem[] = [
    { slug: 'step-1', title: 'First Step' },
    { slug: 'step-2', title: 'Second Step' },
    { slug: 'step-3', title: 'Third Step' },
  ];

  it('correctly styles completed, current, and upcoming steps, segments, and interactivity', () => {
    render(<WizardStepSummary steps={steps} currentStepSlug="step-2" />);

    const listitems = screen.getAllByRole('listitem');
    expect(listitems).toHaveLength(3);

    // Step 1: Completed (index 0 < current index 1)
    // Completed items show a checkmark instead of index number
    expect(listitems[0]).toHaveTextContent('First Step');
    expect(listitems[0]).not.toHaveAttribute('aria-current');
    
    // Step 2: Current (index 1 === current index 1)
    expect(listitems[1]).toHaveTextContent('2');
    expect(listitems[1]).toHaveTextContent('Second Step');
    expect(listitems[1]).toHaveAttribute('aria-current', 'step');

    // Step 3: Upcoming (index 2 > current index 1)
    expect(listitems[2]).toHaveTextContent('3');
    expect(listitems[2]).toHaveTextContent('Third Step');
    expect(listitems[2]).not.toHaveAttribute('aria-current');

    // Connecting segments
    const segment0 = screen.getByTestId('segment-0'); // between 1 & 2 (index 0 < current index 1) -> filled (blue)
    const segment1 = screen.getByTestId('segment-1'); // between 2 & 3 (index 1 not < current index 1) -> empty (gray)

    expect(segment0).toHaveClass('bg-blue-500');
    expect(segment1).toHaveClass('bg-gray-200');

    // Interactivity check: make sure none of them is clickable (no buttons or anchors)
    listitems.forEach((item) => {
      expect(item.querySelector('button')).toBeNull();
      expect(item.querySelector('a')).toBeNull();
      expect(item).not.toHaveAttribute('tabIndex');
    });
  });
});
