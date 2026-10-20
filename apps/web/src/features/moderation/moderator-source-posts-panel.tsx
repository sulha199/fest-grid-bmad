'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ReextractPostDialog } from './reextract-post-dialog';

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
 */
export function ModeratorSourcePostsPanel({ sourcePosts }: ModeratorSourcePostsPanelProps) {
  const t = useTranslations('ReextractPreview');
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  if (sourcePosts.length === 0) return null;

  return (
    <section className="mt-4 rounded-lg border border-dashed p-4" aria-label={t('panelHeading')}>
      <h2 className="text-sm font-semibold">{t('panelHeading')}</h2>
      <ul className="mt-2 space-y-2">
        {sourcePosts.map((post) => (
          <li key={post.postId} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">
              {post.sourcePostUrl ? (
                <a className="underline" href={post.sourcePostUrl} target="_blank" rel="noopener noreferrer">
                  {post.title || post.sourcePostUrl}
                </a>
              ) : (
                (post.title ?? post.postId)
              )}
              {post.account?.username ? <span className="text-muted-foreground"> · @{post.account.username}</span> : null}
            </span>
            <Button variant="outline" size="sm" onClick={() => setOpenPostId(post.postId)}>
              {t('reextractButton')}
            </Button>
          </li>
        ))}
      </ul>
      <ReextractPostDialog isOpen={openPostId !== null} postId={openPostId ?? ''} onClose={() => setOpenPostId(null)} />
    </section>
  );
}
