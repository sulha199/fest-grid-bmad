import * as React from 'react';
import { List, LayoutGrid } from 'lucide-react';
import { Button } from '../../core/ui/button';
import { cn } from '../../lib/utils';
import { ViewModeToggleProps } from './ViewModeToggle.types';

export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  labels,
  className,
}: ViewModeToggleProps) {
  return (
    <div className={cn("inline-flex items-center rounded-md border bg-background p-0.5", className)}>
      <Button
        type="button"
        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7 rounded-sm p-0"
        aria-pressed={viewMode === 'list'}
        aria-label={labels.list}
        title={labels.list}
        onClick={() => {
          if (viewMode !== 'list') {
            onViewModeChange('list');
          }
        }}
      >
        <List className="h-4 w-4" />
        <span className="sr-only">{labels.list}</span>
      </Button>
      <Button
        type="button"
        variant={viewMode === 'masonry' ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7 rounded-sm p-0"
        aria-pressed={viewMode === 'masonry'}
        aria-label={labels.masonry}
        title={labels.masonry}
        onClick={() => {
          if (viewMode !== 'masonry') {
            onViewModeChange('masonry');
          }
        }}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">{labels.masonry}</span>
      </Button>
    </div>
  );
}
