import React from 'react';
import { WizardNavigationProps } from './WizardNavigation.types';

export function WizardNavigation({
  isFirstStep,
  isLastStep,
  isStepCompleted,
  canSkipStep,
  labels,
  onPrevious,
  onNext,
  onSkip,
  onComplete,
}: WizardNavigationProps) {
  return (
    <div className="flex items-center justify-between py-4 border-t border-gray-100 mt-6 w-full">
      <div>
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirstStep}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {labels.previous}
        </button>
      </div>
      <div className="flex items-center space-x-3">
        {canSkipStep && !isLastStep && (
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-all duration-200"
          >
            {labels.skip}
          </button>
        )}
        {!isLastStep ? (
          <button
            type="button"
            onClick={onNext}
            disabled={!isStepCompleted}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {labels.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            disabled={!isStepCompleted}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {labels.complete}
          </button>
        )}
      </div>
    </div>
  );
}
export default WizardNavigation;
