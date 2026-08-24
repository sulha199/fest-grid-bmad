import * as React from 'react';
import { cn } from '../lib/utils';
import { GridContainerProps } from './grid-container.types';

const BASE_COL_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
};

const MD_COL_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
  7: 'md:grid-cols-7',
  8: 'md:grid-cols-8',
};

const LG_COL_CLASS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
  8: 'lg:grid-cols-8',
};

const XL_COL_CLASS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
  7: 'xl:grid-cols-7',
  8: 'xl:grid-cols-8',
};

const TWO_XL_COL_CLASS: Record<number, string> = {
  1: '2xl:grid-cols-1',
  2: '2xl:grid-cols-2',
  3: '2xl:grid-cols-3',
  4: '2xl:grid-cols-4',
  5: '2xl:grid-cols-5',
  6: '2xl:grid-cols-6',
  7: '2xl:grid-cols-7',
  8: '2xl:grid-cols-8',
};

/**
 * GridContainer is a shared, presentational card-grid container component.
 * It manages responsive column layout from numeric baseCols and colsStep props,
 * using a static lookup table so Tailwind can statically compile all utility classes.
 */
export function GridContainer({
  children,
  baseCols = 1,
  colsStep = 1,
  gap = 'gap-4',
  className,
}: GridContainerProps) {
  const colsBase = baseCols;
  const colsMd = baseCols + colsStep * 1;
  const colsLg = baseCols + colsStep * 2;
  const colsXl = baseCols + colsStep * 3;
  const cols2xl = baseCols + colsStep * 4;

  const validateCols = (val: number, breakpoint: string) => {
    if (val < 1 || val > 8) {
      throw new Error(
        `GridContainer: Column count ${val} at breakpoint '${breakpoint}' is out of the supported range (1-8). baseCols: ${baseCols}, colsStep: ${colsStep}`
      );
    }
  };

  validateCols(colsBase, 'base');
  validateCols(colsMd, 'md');
  validateCols(colsLg, 'lg');
  validateCols(colsXl, 'xl');
  validateCols(cols2xl, '2xl');

  return (
    <div
      className={cn(
        "grid",
        gap,
        BASE_COL_CLASS[colsBase],
        MD_COL_CLASS[colsMd],
        LG_COL_CLASS[colsLg],
        XL_COL_CLASS[colsXl],
        TWO_XL_COL_CLASS[cols2xl],
        className
      )}
    >
      {children}
    </div>
  );
}

export * from './grid-container.types';
