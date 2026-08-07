import React from 'react';
import { Check } from 'lucide-react';
import { WizardStepSummaryProps } from './WizardStepSummary.types';

export function WizardStepSummary({ steps, currentStepSlug }: WizardStepSummaryProps) {
  const currentIndex = steps.findIndex((s) => s.slug === currentStepSlug);

  return (
    <div role="list" className="flex items-center justify-between w-full py-4">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;
        const isSegmentFilled = index < currentIndex;
        const hasNextSegment = index < steps.length - 1;

        // Circle styles per state
        let circleClass = 'flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-semibold transition-colors duration-200';
        if (isCompleted) {
          circleClass += ' bg-blue-500 border-blue-500 text-white'; // #3B82F6 is blue-500
        } else if (isCurrent) {
          circleClass += ' bg-white border-blue-500 text-blue-500';
        } else {
          // Upcoming
          circleClass += ' bg-white border-gray-300 text-gray-400'; // #6B7280 is gray-500 (text) / border gray-300
        }

        // Text style per state
        let textClass = 'text-sm font-medium transition-colors duration-200';
        if (isCompleted) {
          textClass += ' text-gray-900';
        } else if (isCurrent) {
          textClass += ' text-blue-500 font-semibold';
        } else {
          textClass += ' text-gray-500'; // #6B7280 / gray-500
        }

        return (
          <React.Fragment key={step.slug}>
            <div
              role="listitem"
              className="flex items-center space-x-2"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className={circleClass}>
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className={textClass}>{step.title}</span>
            </div>
            {hasNextSegment && (
              <div
                className={`flex-1 h-0.5 mx-4 transition-colors duration-200 ${
                  isSegmentFilled ? 'bg-blue-500' : 'bg-gray-200'
                }`}
                data-testid={`segment-${index}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
export default WizardStepSummary;
