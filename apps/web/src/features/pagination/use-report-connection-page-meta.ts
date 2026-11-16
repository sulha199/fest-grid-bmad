'use client';

import { useEffect } from 'react';
import type { UseListPaginationControllerResult } from '@festgrid/ui';

type ConnectionPageMeta =
  | {
      pageInfo?: { hasNextPage?: boolean | null } | null;
      totalCount?: number | null;
    }
  | null
  | undefined;

/**
 * Tells `useListPaginationController` what the page just fetched says about the rest of the list
 * (`hasNextPage`, `totalCount`), as the controller's contract requires after each successful fetch.
 *
 * Why `resetToken` is a dependency: a filter change clears the controller's `hasNextPage` and
 * `totalCount` back to "unknown". If the new page reports the same values the old one did, none of
 * the other dependencies changes, the effect would not run again, and Next would stay disabled on a
 * page that has more. Re-running on `resetToken` closes that gap. While the new page is still
 * loading `connection` is empty and nothing is reported, so the cleared state is never overwritten
 * with the old page's numbers.
 */
export function useReportConnectionPageMeta(
  pagination: Pick<UseListPaginationControllerResult<string | undefined>, 'reportPageMeta' | 'resetToken'>,
  connection: ConnectionPageMeta,
): void {
  const { reportPageMeta, resetToken } = pagination;
  const hasConnection = connection != null;
  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const totalCount = connection?.totalCount ?? undefined;

  useEffect(() => {
    if (hasConnection) reportPageMeta({ hasNextPage, totalCount });
  }, [hasConnection, hasNextPage, totalCount, resetToken, reportPageMeta]);
}
