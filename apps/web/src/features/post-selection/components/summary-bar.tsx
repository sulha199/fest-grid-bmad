import React from 'react';

interface SummaryBarProps {
  selectedCount: number;
  quota: number;
  isExtracting?: boolean;
  onExtract?: () => void;
}

export function SummaryBar({ selectedCount, quota, isExtracting = false, onExtract }: SummaryBarProps) {
  const isOverQuota = selectedCount > quota;

  return (
    <div className="fixed bottom-14 md:bottom-0 inset-x-0 bg-background border-t border-slate-200 dark:border-slate-800 p-4 shadow-lg flex items-center justify-between max-w-7xl mx-auto rounded-t-xl z-50">
      <span className={`font-semibold text-sm sm:text-base ${isOverQuota ? 'text-red-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
        Selected Posts: {selectedCount} / {quota}
      </span>
      <button
        onClick={onExtract}
        disabled={isExtracting || selectedCount === 0 || isOverQuota}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        Extract Events
      </button>
    </div>
  );
}
