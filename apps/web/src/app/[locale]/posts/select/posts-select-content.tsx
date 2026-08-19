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
  useRemoveSubscriptionMutation,
  useTriggerAccountScrapeMutation,
  SoftDeleteAction,
} from '@/generated/graphql';
import { PostCard, PostCardSkeleton, BlockingLoader, useSoftDeleteWithUndo } from '@festgrid/ui';
import { AlertCircle, TriangleAlert } from 'lucide-react';
import { usePostSelectionStore } from './post-selection-store';
import { toast } from 'sonner';
import { SummaryBar } from '@/features/post-selection/components/summary-bar';
import { useQueryClient } from '@tanstack/react-query';

export function PostsSelectContent() {
  const t = useTranslations('ManualPostSelectionPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';
  const { session, isLoading: authLoading } = useAuthSession();
  const queryClient = useQueryClient();

  const { selectedPostIds, togglePost, clearSelection } = usePostSelectionStore();

  // 1. Fetch Subscriptions
  // Determine if we should poll based on isScrapeInProgress and timeout
  const shouldPoll = activeSub?.account?.isScrapeInProgress && scrapePollingStartTime;
  const pollTimeElapsed = scrapePollingStartTime ? Date.now() - scrapePollingStartTime : 0;
  const pollTimeoutMs = 60000; // 60 seconds
  const shouldStopPolling = pollTimeElapsed > pollTimeoutMs;

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
      refetchInterval: shouldPoll && !shouldStopPolling ? 3000 : false, // Poll every 3s, or stop if timeout
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

  // 4. Soft delete subscription with undo setup
  const { mutateAsync: removeSubscription } = useRemoveSubscriptionMutation(graphqlClient);

  const { isPending: isSoftDeletePending, markPending } = useSoftDeleteWithUndo<string>({
    onExpire: (id) => {
      queryClient.setQueryData(['getMySubscriptions'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          mySubscriptions: (old.mySubscriptions || []).filter((sub: any) => sub.id !== id),
        };
      });
      refetchSubs();
    },
  });

  const rawSubscriptions = subData?.mySubscriptions || [];
  // Filter out any subscription currently in the soft-deleted pending queue
  const subscriptions = rawSubscriptions.filter((sub) => !isSoftDeletePending(sub.id));
  
  const apiKeys = keysData?.myApiKeys || [];
  const remainingQuota = quotaData?.myExtractionQuota?.remaining ?? 0;

  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [scrapePollingStartTime, setScrapePollingStartTime] = useState<number | null>(null);

  // Trigger account scrape mutation
  const { mutate: triggerScrape, isPending: isScraping } = useTriggerAccountScrapeMutation(
    graphqlClient,
    {
      onSuccess: () => {
        // Start polling timer
        setScrapePollingStartTime(Date.now());
        toast.success(t('scrapePostsButton') || 'Scrape triggered');
      },
      onError: (err: any) => {
        const code = err?.response?.errors?.[0]?.extensions?.code;
        if (code === 'SCRAPE_ALREADY_IN_PROGRESS') {
          toast.error(t('scrapeAlreadyInProgressToast') || 'Scrape already in progress');
        } else if (code === 'SCRAPER_CAPACITY_EXCEEDED') {
          toast.error(t('scrapeCapacityExceededToast') || 'Scraper capacity exceeded');
        } else {
          toast.error(t('scrapeGenericErrorToast') || 'Failed to start scraping');
        }
      },
    }
  );

  // 5. Handle auth redirect
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [authLoading, session, router]);

  // 6. Wizard Redirection Logic
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

  // 7. Auto-activation of tabs
  useEffect(() => {
    if (subscriptions.length > 0 && (!activeAccountId || !subscriptions.some(s => s.account.id === activeAccountId))) {
      const newlyAdded = subscriptions.find((s) => s.isNewlyAdded);
      if (newlyAdded) {
        setActiveAccountId(newlyAdded.account.id);
      } else {
        setActiveAccountId(subscriptions[0].account.id);
      }
    }
  }, [subscriptions, activeAccountId]);

  // 8. Mutation to mark subscription as viewed
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

  // 9. Query posts for the active account
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

  // Refetch posts when scrape completes
  useEffect(() => {
    if (activeSub && scrapePollingStartTime && !activeSub.account.isScrapeInProgress) {
      refetchPosts();
      setScrapePollingStartTime(null);
    }
  }, [activeSub?.account?.isScrapeInProgress, activeSub?.account?.id, scrapePollingStartTime, refetchPosts]);

  // 10. Mutation to select posts for extraction
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

  const handleDeleteSubscription = async (sub: any) => {
    try {
      await removeSubscription({
        id: sub.id,
        action: SoftDeleteAction.Delete,
      });

      markPending(
        sub.id,
        async () => {
          try {
            await removeSubscription({
              id: sub.id,
              action: SoftDeleteAction.Restore,
            });
            refetchSubs();
          } catch (err) {
            console.error('Failed to restore subscription', err);
            throw err;
          }
        },
        t('removeSuccess') || 'Subscription removed successfully'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove subscription.');
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

  // Helper to render the Scrape Posts control
  const renderScrapeControl = () => {
    if (!activeSub) return null;

    const isInProgress = activeSub.account.isScrapeInProgress;
    const hasTimedOut = scrapePollingStartTime && (Date.now() - scrapePollingStartTime) > pollTimeoutMs;
    const isDisabled = isInProgress || isScraping;

    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => triggerScrape({ accountId: activeSub.account.id })}
          disabled={isDisabled}
          className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-10 px-4 py-2 gap-2 ${
            isDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {isInProgress && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {t('scrapePostsButton')}
        </button>
        {isInProgress && !hasTimedOut && (
          <p className="text-xs text-muted-foreground">{t('scrapeInProgressLabel')}</p>
        )}
        {hasTimedOut && (
          <p className="text-xs text-muted-foreground">{t('scrapeTimeoutMessage')}</p>
        )}
      </div>
    );
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
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <BlockingLoader active={isExtracting} label="Extracting event data..." />

      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* Tabs list */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
        {activeSub && posts.length > 0 && renderScrapeControl()}
      </div>

      {/* Inactive Account Warning Banner */}
      {activeSub?.isInactive && (
        <div className="p-4 border rounded-xl bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold leading-tight">{t('inactiveAccountAlertTitle')}</h4>
              <p className="text-sm opacity-90 leading-normal">{t('inactiveAccountAlertDescription')}</p>
            </div>
          </div>
          <button
            onClick={() => handleDeleteSubscription(activeSub)}
            className="whitespace-nowrap inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2"
          >
            {t('removeSubscriptionBtn')}
          </button>
        </div>
      )}

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
          <div className="text-center p-16 border rounded-xl border-dashed border-slate-200 dark:border-slate-800 space-y-4">
            <p className="text-muted-foreground font-medium">{t('scrapePostsEmptyStateCta')}</p>
            {renderScrapeControl()}
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
