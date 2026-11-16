'use client';

import { useTranslations } from 'next-intl';

/**
 * Shown by a paged list when its current page has no rows although earlier pages exist: the moderator
 * resolved or removed every row on the last page, so the page they are on is now past the end of the list.
 * `PaginationControls` stays rendered beneath it, so Previous is one keypress away. An empty first page is
 * not this case: the list's own empty state covers it.
 */
export function EmptyPageNotice() {
  const t = useTranslations('Pagination');
  return (
    <p role="status" className="py-8 text-center text-sm text-muted-foreground">
      {t('emptyPage')}
    </p>
  );
}
