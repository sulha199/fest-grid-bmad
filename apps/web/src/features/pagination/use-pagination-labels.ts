'use client';

import { useTranslations } from 'next-intl';
import type { PaginationControlsLabels } from '@festgrid/ui';

/**
 * Locale-aware labels for `PaginationControls` (Story 0.i5c): "Page N of M" plus the total when the
 * list knows it, or just "Page N" when it does not.
 *
 * The page count never reads lower than the current page, so a page whose last rows were just
 * resolved ("Page 3 of 2") still reads sensibly while the moderator steps back.
 */
export function usePaginationLabels(
  pageIndex: number,
  totalCount: number | undefined,
  pageSize: number,
): PaginationControlsLabels {
  const t = useTranslations('Pagination');
  const pageCount = totalCount === undefined ? undefined : Math.max(pageIndex, Math.ceil(totalCount / pageSize), 1);

  return {
    navigation: t('navigation'),
    previous: t('previous'),
    next: t('next'),
    pageInfo: pageCount === undefined ? t('page', { page: pageIndex }) : t('pageOfPages', { page: pageIndex, pages: pageCount }),
    total: totalCount === undefined ? undefined : t('total', { count: totalCount }),
  };
}
