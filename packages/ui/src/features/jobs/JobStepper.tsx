import React from 'react';
import { Check, Minus, X } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { cn } from '../../lib/utils';
import type { JobProgressLabels, JobProgressStep } from './job-progress.types';

export interface JobStepperItem {
  step: JobProgressStep;
  label: string;
  stopped?: boolean;
}

export interface JobStepperProps {
  items: ReadonlyArray<JobStepperItem>;
  labels: Pick<JobProgressLabels, 'stepsLabel' | 'stepState' | 'countDetail'>;
}

const MARKER_BASE = 'h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold';

/** A vertical ordered list at every width. `aria-current="step"` on the current item plus a hidden state word per item. */
export function JobStepper({ items, labels }: JobStepperProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <ol aria-label={labels.stepsLabel} className="flex flex-col gap-3" data-testid="job-stepper">
      {items.map(({ step, label, stopped }, index) => {
        const current = step.state === 'CURRENT';
        const stateWord = stopped ? labels.stepState.stopped : labels.stepState[step.state.toLowerCase() as 'done' | 'current' | 'pending' | 'skipped'];
        const showCount = typeof step.total === 'number' && step.total > 0 && typeof step.done === 'number';
        let marker: React.ReactNode;
        let markerClass: string;
        if (step.state === 'DONE') {
          markerClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
          marker = <Check aria-hidden="true" className="h-4 w-4" />;
        } else if (stopped) {
          markerClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
          marker = <X aria-hidden="true" className="h-4 w-4" />;
        } else if (current) {
          markerClass = 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200';
          marker = reduced ? (
            <span aria-hidden="true" data-testid="job-step-static-dot" className="h-2.5 w-2.5 rounded-full bg-current" />
          ) : (
            <span aria-hidden="true" data-testid="job-step-spinner" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
          );
        } else if (step.state === 'SKIPPED') {
          markerClass = 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200';
          marker = <Minus aria-hidden="true" className="h-4 w-4" />;
        } else {
          markerClass = 'border border-border text-muted-foreground';
          marker = <span aria-hidden="true">{index + 1}</span>;
        }
        return (
          <li key={`${step.key}-${index}`} className="flex min-h-6 min-w-0 items-start gap-3" aria-current={current ? 'step' : undefined} data-state={step.state}>
            <span className={cn(MARKER_BASE, markerClass)}>{marker}</span>
            <span className="min-w-0">
              <span className={cn('break-words text-sm', current && 'font-semibold')}>{label}</span>
              <span className="sr-only"> ({stateWord})</span>
              {showCount && current && <span className="block text-xs text-muted-foreground">{labels.countDetail(step.done as number, step.total as number)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Same heights as the real stepper rows (marker `h-6`), so the swap does not shift the layout. */
export function JobStepperSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ol className="flex flex-col gap-3" aria-hidden="true" data-testid="job-stepper-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex min-h-6 items-start gap-3">
          <span className={cn(MARKER_BASE, 'animate-pulse bg-muted')} />
          <span className="mt-1 h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ol>
  );
}
