'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { JobType } from '@/generated/graphql';
import { ReextractJobHost } from './reextract-job-host';

export interface ModeratorSourcePost {
  postId: string;
  title?: string | null;
  sourcePostUrl?: string | null;
  account?: { username?: string | null } | null;
}

interface ModeratorSourcePostsPanelProps {
  sourcePosts: ModeratorSourcePost[];
}

/**
 * AD-40 -- moderator-only list of an event's source posts, each with a "Re-extract" button.
 * Deliberately separate from EventDetailView's own source-post list, which only renders for events
 * with more than one source post (AD-30): a single-post event has to be reachable too.
 *
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): one `ReextractJobHost` per row, so each post has its own chip and its
 * own dialog. The row wraps (`flex-wrap`, `min-w-0`): on a 320 px phone the button or chip sits under a long title instead of being pushed off screen.
 */
export function ModeratorSourcePostsPanel({ sourcePosts }: ModeratorSourcePostsPanelProps) {
  const t = useTranslations('ReextractPreview');

  if (sourcePosts.length === 0) return null;

  return (
    <section className="mt-4 rounded-lg border border-dashed p-4" aria-label={t('panelHeading')}>
      <h2 className="text-sm font-semibold">{t('panelHeading')}</h2>
      <ul className="mt-2 space-y-2">
        {sourcePosts.map((post) => (
          <li key={post.postId} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2" data-testid="reextract-row">
            <span className="min-w-0 max-w-full truncate text-sm">
              {post.sourcePostUrl ? (
                <a className="underline" href={post.sourcePostUrl} target="_blank" rel="noopener noreferrer">
                  {post.title || post.sourcePostUrl}
                </a>
              ) : (
                (post.title ?? post.postId)
              )}
              {post.account?.username ? <span className="text-muted-foreground"> · @{post.account.username}</span> : null}
            </span>
            <ReextractJobHost subject={{ type: JobType.ReextractRefresh, postId: post.postId }}>
              {({ start, starting, hasJob, triggerRef }) =>
                hasJob ? null : (
                  <Button ref={triggerRef} variant="outline" size="sm" className="min-h-11 sm:min-h-0" disabled={starting} aria-busy={starting || undefined} onClick={() => void start({ postId: post.postId })}>
                    {t('reextractButton')}
                  </Button>
                )
              }
            </ReextractJobHost>
          </li>
        ))}
      </ul>
    </section>
  );
}
