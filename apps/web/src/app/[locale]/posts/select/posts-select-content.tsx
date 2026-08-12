'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { useRouter, Link } from '@/i18n/navigation';
import { graphqlClient } from '@/lib/graphql-client';
import { useSearchParams } from 'next/navigation';
import {
  useGetMySubscriptionsQuery,
  useGetMyApiKeysQuery,
  useGetPostsByAccountQuery,
  useMarkSubscriptionViewedMutation,
  useSelectPostsForExtractionMutation,
  useGetMyExtractionQuotaQuery,
} from '@/generated/graphql';
import { PostCard, PostCardSkeleton, BlockingLoader } from '@festgrid/ui';
import { AlertCircle } from 'lucide-react';
import { usePostSelectionStore } from './post-selection-store';
import { toast } from 'sonner';
import { SummaryBar } from '@/features/post-selection/components/summary-bar';

export function PostsSelectContent() {
  const t = useTranslations('ManualPostSelectionPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';
  const { session, isLoading: authLoading } = useAuthSession();

  const { selectedPostIds, togglePost, clearSelection } = usePostSelectionStore();

  // 1. Fetch Subscriptions
  const {
    data: subData,
    isLoading: subLoading,
    error: subError,
    refetch: refetchSubs,
  } = useGetMySubscriptionsQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  );

  // 2. Fetch API Keys
  const {
    data: keysData,
    isLoading: keysLoading,
    error: keysError,
    refetch: refetchKeys,
  } = useGetMyApiKeysQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  );

  // 3. Fetch Extraction Quota
  const {
    data: quotaData,
    isLoading: quotaLoading,
    error: quotaError,
    refetch: refetchQuota,
  } = useGetMyExtractionQuotaQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  );

  const subscriptions = subData?.mySubscriptions || [];
  const apiKeys = keysData?.myApiKeys || [];
  const remainingQuota = quotaData?.myExtractionQuota?.remaining ?? 0;

  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  // 4. Handle auth redirect
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [authLoading, session, router]);

  // 5. Wizard Redirection Logic
  useEffect(() => {
    if (session && !subLoading && !keysLoading) {
      const hasApiKeys = apiKeys.length > 0;
      const hasSubscriptions = subscriptions.length > 0;

      if (!hasApiKeys) {
        router.push(`/wizard/onboarding/api-key?redirect=${encodeURIComponent('/posts/select')}`);
      } else if (!hasSubscriptions) {
        router.push(`/wizard/onboarding/subscribe?redirect=${encodeURIComponent('/posts/select')}`);
      }
    }
  }, [session, subscriptions, apiKeys, subLoading, keysLoading, router]);

  // 6. Auto-activation of tabs
  useEffect(() => {
    if (subscriptions.length > 0 && !activeAccountId) {
      const newlyAdded = subscriptions.find((s) => s.isNewlyAdded);
      if (newlyAdded) {
        setActiveAccountId(newlyAdded.account.id);
      } else {
        setActiveAccountId(subscriptions[0].account.id);
      }
    }
  }, [subscriptions, activeAccountId]);

  // 7. Mutation to mark subscription as viewed
  const { mutate: markViewed } = useMarkSubscriptionViewedMutation(graphqlClient, {
    onSuccess: () => {
      refetchSubs();
    },
  });

  const activeSub = subscriptions.find((s) => s.account.id === activeAccountId);

  useEffect(() => {
    if (activeSub && activeSub.isNewlyAdded) {
      markViewed({ subscriptionId: activeSub.id });
    }
  }, [activeAccountId, activeSub, markViewed]);

  // 8. Query posts for the active account
  const {
    data: postsData,
    isLoading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
  } = useGetPostsByAccountQuery(
    graphqlClient,
    {
      accountId: activeAccountId || '',
      limit: 20,
    },
    {
      enabled: !!activeAccountId,
    }
  );

  const posts = postsData?.postsByAccount?.items || [];

  // 9. Mutation to select posts for extraction
  const { mutate: selectPosts, isPending: isExtracting } = useSelectPostsForExtractionMutation(
    graphqlClient,
    {
      onSuccess: () => {
        const count = selectedPostIds.length;
        clearSelection();
        toast.success(
          t('title') === 'Extract Events'
            ? `Successfully enqueued ${count} posts for extraction!`
            : `Berhasil mengantrekan ${count} postingan untuk diekstrak!`
        );
        refetchQuota();
        router.push(redirectPath);
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to submit selection for extraction.');
      },
    }
  );

  const handleExtract = () => {
    if (selectedPostIds.length > 0) {
      // Authoritative server-side guard
      if (selectedPostIds.length > remainingQuota) {
        toast.error('Cannot select more posts than your remaining API quota.');
        return;
      }
      selectPosts({ postIds: selectedPostIds });
    }
  };

  const isLoading = authLoading || subLoading || keysLoading || quotaLoading;
  const hasError = subError || keysError || quotaError;

  const refetchAll = () => {
    refetchSubs();
    refetchKeys();
    refetchQuota();
    if (activeAccountId) {
      refetchPosts();
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto animate-pulse">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="flex gap-4 border-b pb-2">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-8 w-32 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto text-center space-y-4 mt-20">
        <p className="text-destructive font-medium">Failed to load content. Please try again later.</p>
        <button
          onClick={refetchAll}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // If user has no subscriptions, keep empty until redirected to wizard
  if (subscriptions.length === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto text-center space-y-4 mt-20">
        <p className="text-muted-foreground font-medium">{t('noSubscriptionsEmptyState')}</p>
        <Link
          href="/settings/subscriptions"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {t('noSubscriptionsCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-24">
      <BlockingLoader active={isExtracting} label="Extracting event data..." />

      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* Tabs list */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap gap-2 -mb-px">
          {subscriptions.map((sub) => {
            const isActive = activeAccountId === sub.account.id;
            return (
              <button
                key={sub.account.id}
                onClick={() => setActiveAccountId(sub.account.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{sub.account.displayName}</span>
                {sub.isInactive && (
                  <AlertCircle
                    className="h-4 w-4 text-yellow-500"
                    title={t('inactiveWarningTitle') || 'Inactive Account'}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {postsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : postsError ? (
          <div className="text-center p-8 border rounded-xl border-dashed">
            <p className="text-destructive font-medium mb-4">Failed to load posts for this account.</p>
            <button
              onClick={refetchPosts}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center p-16 border rounded-xl border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-muted-foreground font-medium">{t('noPostsEmptyState')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post) => {
              const isSelected = selectedPostIds.includes(post.id as string);
              const isProcessed = post.isExtracted;
              const quotaReached = selectedPostIds.length >= remainingQuota;
              const isDisabled = isProcessed || (!isSelected && quotaReached);
              const hoverTitle = isProcessed
                ? 'Already processed'
                : !isSelected && quotaReached
                ? 'You have reached your quota limit.'
                : undefined;

              return (
                <div key={post.id} title={hoverTitle}>
                  <PostCard
                    post={{
                      id: post.id as string,
                      accountId: post.accountId as string,
                      content: post.content,
                      imageUrl: post.imageUrl || undefined,
                      postUrl: post.postUrl,
                      originalPostUrl: post.originalPostUrl || undefined,
                      isExtracted: post.isExtracted,
                      publishedAt: post.publishedAt,
                    }}
                    isSelected={isSelected}
                    onSelectionChange={() => togglePost(post.id as string)}
                    disabled={isDisabled}
                    publisher={
                      activeSub
                        ? {
                            displayName: activeSub.account.displayName,
                            username: activeSub.account.username,
                            profileImageUrl: activeSub.account.profileImageUrl || undefined,
                            platform: activeSub.account.platform,
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Bar */}
      <SummaryBar
        selectedCount={selectedPostIds.length}
        quota={remainingQuota}
        isExtracting={isExtracting}
        onExtract={handleExtract}
      />
    </div>
  );
}
