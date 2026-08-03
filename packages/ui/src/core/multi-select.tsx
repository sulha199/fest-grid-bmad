import * as React from 'react';
import { MultiSelectProps } from './multi-select.types';

/**
 * A reusable MultiSelect faceted-filter component.
 * Renders a facet label and tap-to-toggle option buttons, along with an optional Clear action.
 */
export function MultiSelect({
  facetLabel,
  options,
  selectedValues,
  onChange,
  labels,
  hideClearAction,
}: MultiSelectProps) {
  const [optimisticValues, setOptimisticValues] = React.useOptimistic(selectedValues);

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {facetLabel}
        </span>
      </div>
    );
  }

  const clearLabel = labels?.clearLabel ?? 'Clear';
  const hasSelection = optimisticValues.length > 0;

  const handleToggle = (value: string) => {
    const next = optimisticValues.includes(value)
      ? optimisticValues.filter((v) => v !== value)
      : [...optimisticValues, value];

    React.startTransition(() => {
      setOptimisticValues(next);
      onChange(next);
    });
  };

  const handleClear = () => {
    React.startTransition(() => {
      setOptimisticValues([]);
      onChange([]);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {facetLabel}
        </span>
        {hasSelection && !hideClearAction && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            {clearLabel}
          </button>
        )}
      </div>
      <div
        role="group"
        aria-label={facetLabel}
        className="flex flex-wrap items-center gap-2"
      >
        {options.map((option) => {
          const isSelected = optimisticValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleToggle(option.value)}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-full border transition-colors
                ${
                  isSelected
                    ? 'bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-800 dark:text-blue-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export * from './multi-select.types';
