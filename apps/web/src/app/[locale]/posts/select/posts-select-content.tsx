'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { useRouter, Link } from '@/i18n/navigation';
import { graphqlClient } from '@/lib/graphql-client';
import { useSearchParams } from 'next/navigation';
import {
  useGetMySubscriptionsQuery,
  useGetMyApiKeysQuery,
  GetPostsByAccountDocument,
  type GetPostsByAccountQuery,
  useMarkSubscriptionViewedMutation,
  useSelectPostsForExtractionMutation,
  useGetMyExtractionQuotaQuery,
  useRemoveSubscriptionMutation,
  useTriggerAccountScrapeMutation,
  SoftDeleteAction,
  Subscription,
  PostExtractionStatus as GeneratedPostExtractionStatus,
} from '@/generated/graphql';
import { PostCard, PostCardSkeleton, BlockingLoader, useSoftDeleteWithUndo, PageContainer, GridContainer, AccountAvatar, useInfiniteScroll, StatusBadge } from '@festgrid/ui';
import { AlertCircle, TriangleAlert, Ban, Clock, Hourglass, History, Loader2 } from 'lucide-react';
import { usePostSelectionStore } from './post-selection-store';
import { toast } from 'sonner';
import { SummaryBar } from '@/features/post-selection/components/summary-bar';
import { ExtractionStatusFilter, type PostExtractionStatus } from '@/features/posts/ExtractionStatusFilter';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

export function PostsSelectContent() {
  const t = useTranslations('ManualPostSelectionPage');
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';
  const { session, isLoading: authLoading } = useAuthSession();
  const queryClient = useQueryClient();

  const { selectedPostIds, togglePost, clearSelection } = usePostSelectionStore();

  // 1. Fetch Subscriptions
  const {
    data: subData,
    isLoading: subLoading,
    error: subError,
    refetch: refetchSubs,
  } = useGetMySubscriptionsQuery(
    graphqlClient,
    undefined,
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
    undefined,
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
  
  const apiKeys = useMemo(() => keysData?.myApiKeys || [], [keysData?.myApiKeys]);
  const remainingQuota = quotaData?.myExtractionQuota?.remaining ?? 0;

  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [scrapePollingStartTime, setScrapePollingStartTime] = useState<number | null>(null);
  const formatDate = (value?: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: 'medium' }) : '';
  // PRD 3.10: the status filter applies to every tab; by default only Pending posts are shown.
  const [statusFilter, setStatusFilter] = useState<PostExtractionStatus[]>(['PENDING']);
  const statusLabels: Record<PostExtractionStatus, string> = {
    PENDING: t('extractionStatusPending'),
    QUEUED: t('extractionStatusQueued'),
    EXTRACTING: t('extractionStatusExtracting'),
    PROMOTED: t('extractionStatusPromoted'),
    NOT_EVENT: t('extractionStatusNotEvent'),
  } as Record<PostExtractionStatus, string>;
  const statusBadgeVariant = {
    PENDING: 'pending',
    QUEUED: 'queued',
    EXTRACTING: 'extracting',
    PROMOTED: 'promoted',
    NOT_EVENT: 'notEvent',
  } as const;

  // Trigger account scrape mutation
  const { mutate: triggerScrape, isPending: isScraping } = useTriggerAccountScrapeMutation(
    graphqlClient,
    {
      onSuccess: () => {
        // The server stamps scrapeTriggeredAt inside the mutation, so refetch the subscriptions
        // to pick up isScrapeInProgress. The polling timer is deliberately not started here: it
        // starts once that flag is observed true (see the effect below). Starting it now would
        // let the completion effect treat the still-stale `false` as "scrape finished" and clear
        // it, and polling itself only runs while the flag is true.
        refetchSubs();
        toast.success(t('scrapeStartedToast') || 'Scrape started');
      },
      onError: (err: any) => {
        const code = err?.response?.errors?.[0]?.extensions?.code;
        if (code === 'SCRAPE_ALREADY_IN_PROGRESS') {
          toast.error(t('scrapeAlreadyInProgressToast') || 'Scrape already in progress');
        } else if (code === 'SCRAPER_CAPACITY_EXCEEDED') {
          toast.error(t('scrapeCapacityExceededToast') || 'Scraper capacity exceeded');
        } else if (code === 'FORBIDDEN') {
          // Account type (e.g. PERSONAL, or still awaiting classification approval) isn't scrapable.
          toast.error(t('scrapeNotAllowedForAccountTypeToast') || 'Scraping is not allowed for this account type');
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

  // Polling configuration
  const pollTimeoutMs = 60000; // 60 seconds
  const shouldPoll = activeSub?.account?.isScrapeInProgress && scrapePollingStartTime;
  const pollTimeElapsed = scrapePollingStartTime ? Date.now() - scrapePollingStartTime : 0;
  const shouldStopPolling = pollTimeElapsed > pollTimeoutMs;

  // Start tracking poll elapsed time as soon as a scrape is observed to be in
  // progress, even if it wasn't triggered from this session (e.g. on page load
  // or after a tab switch while a scrape kicked off elsewhere is still running).
  useEffect(() => {
    if (activeSub?.account?.isScrapeInProgress && scrapePollingStartTime === null) {
      setScrapePollingStartTime(Date.now())
    }
  }, [activeSub?.account?.isScrapeInProgress, scrapePollingStartTime])

  // Set up polling interval for subscription updates
  useEffect(() => {
    if (!shouldPoll || shouldStopPolling) return;

    const pollInterval = setInterval(() => {
      refetchSubs();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [shouldPoll, shouldStopPolling, refetchSubs]);

  useEffect(() => {
    if (activeSub && activeSub.isNewlyAdded) {
      markViewed({ subscriptionId: activeSub.id });
    }
  }, [activeAccountId, activeSub, markViewed]);

  // 9. Query posts for the active account, filtered by extraction status (PRD 3.10; default Pending),
  // paged by cursor and appended as the user scrolls.
  const {
    data: postsData,
    isLoading: postsLoading,
    error: postsError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<GetPostsByAccountQuery, Error, InfiniteData<GetPostsByAccountQuery>, any[], string | null>({
    queryKey: ['getPostsByAccount', { accountId: activeAccountId, statuses: statusFilter }],
    queryFn: ({ pageParam }) =>
      graphqlClient.request<GetPostsByAccountQuery>({
        document: GetPostsByAccountDocument,
        variables: {
          accountId: activeAccountId || '',
          cursor: pageParam,
          limit: 20,
          statuses: statusFilter as GeneratedPostExtractionStatus[],
        },
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.postsByAccount.hasMore ? lastPage.postsByAccount.nextCursor : undefined,
    enabled: !!activeAccountId,
  });

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const refetchPosts = () => refetch();

  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (postsData?.pages ?? [])
      .flatMap((page) => page.postsByAccount.items)
      .filter((post) => (seen.has(post.id) ? false : (seen.add(post.id), true)));
  }, [postsData]);

  // A selected post that has since left Pending (queued by this user elsewhere or by another
  // subscriber) can no longer be selected: drop it so it is not submitted or counted.
  useEffect(() => {
    const stale = posts
      .filter((post) => post.extractionStatus !== 'PENDING' && selectedPostIds.includes(post.id as string))
      .map((post) => post.id as string);
    if (stale.length > 0) {
      stale.forEach((id) => togglePost(id));
    }
  }, [posts, selectedPostIds, togglePost]);

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
      onSuccess: (data, variables) => {
        const total = Array.isArray(variables.postIds) ? variables.postIds.length : 1;
        const queued = data.selectPostsForExtraction.length;
        clearSelection();
        if (queued < total) {
          // Some posts left Pending between selection and submit (for example queued by another
          // subscriber of a co-author); the rest were queued.
          toast.warning(t('selectionPartiallyQueued', { queued, total }));
        } else {
          toast.success(
            t('title') === 'Extract Events'
              ? `Successfully enqueued ${queued} posts for extraction!`
              : `Berhasil mengantrekan ${queued} postingan untuk diekstrak!`
          );
        }
        refetchQuota();
        router.push(redirectPath);
      },
      onError: (err: any) => {
        const code = err?.response?.errors?.[0]?.extensions?.code;
        if (code === 'CONFLICT' || code === 'BAD_REQUEST') {
          // None of the posts could be queued: they are no longer Pending.
          clearSelection();
          refetchPosts();
          toast.error(t('selectionNoLongerPending'));
          return;
        }
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

  const handleDeleteSubscription = async (sub: Pick<Subscription, 'id'>) => {
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
        {
          message: t('removeSuccess') || 'Subscription removed successfully' 
        }
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
        <GridContainer baseCols={1} colsStep={1} gap="gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-xl" />
          ))}
        </GridContainer>
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
          href="/settings/account"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {t('noSubscriptionsCta')}
        </Link>
      </div>
    );
  }

  return (
    <PageContainer>
      <BlockingLoader active={isExtracting} label="Extracting event data..." />

      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* Inactive Account Warning Banner */}
      {activeSub?.activityState === 'INACTIVE' && (
        <div className="p-4 border rounded-xl bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold leading-tight">{t('inactiveAccountAlertTitle')}</h4>
              <p className="text-sm opacity-90 leading-normal">{t('inactiveAccountAlertDescription')}</p>
              <p className="text-sm opacity-90 leading-normal">
                {activeSub.latestPostAt
                  ? t('inactiveAccountAlertDetails', {
                      lastChecked: formatDate(activeSub.account.lastScrapedAt),
                      latestPost: formatDate(activeSub.latestPostAt),
                    })
                  : t('inactiveAccountAlertNoPosts', { lastChecked: formatDate(activeSub.account.lastScrapedAt) })}
              </p>
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

      {/* Card wrapper */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 mt-6">
        <p className="text-sm font-medium text-muted-foreground mb-2">{t('postsFromLabel')}</p>

        {/* Tabs list */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible gap-2">
            {subscriptions.map((sub) => {
              const isActive = activeAccountId === sub.account.id;
              return (
                <button
                  key={sub.account.id}
                  onClick={() => setActiveAccountId(sub.account.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <AccountAvatar
                    profileImageUrl={sub.account.profileImageUrl}
                    displayName={sub.account.displayName}
                    username={sub.account.username}
                    size="xs"
                  />

                  <span>{sub.account.displayName}</span>
                  {sub.activityState === 'INACTIVE' && (
                    <AlertCircle
                      className="h-4 w-4 text-yellow-500 shrink-0"
                      xlinkTitle={t('inactiveWarningTitle') || 'Inactive Account'}
                    />
                  )}
                  {sub.activityState === 'NEVER_SCRAPED' && (
                    <span role="img" aria-label={t('neverScrapedBadgeTooltip')} title={t('neverScrapedBadgeTooltip')}>
                      <Hourglass className="h-4 w-4 text-muted-foreground shrink-0" />
                    </span>
                  )}
                  {sub.activityState === 'SCRAPE_IN_PROGRESS' && (
                    <span role="img" aria-label={t('scrapeInProgressLabel')} title={t('scrapeInProgressLabel')}>
                      <Loader2 className="h-4 w-4 text-sky-500 shrink-0 animate-spin" />
                    </span>
                  )}
                  {sub.activityState === 'SCRAPE_STALE' && (
                    <span
                      role="img"
                      aria-label={t('scrapeStaleBadgeTooltip', { date: formatDate(sub.account.lastScrapedAt) })}
                      title={t('scrapeStaleBadgeTooltip', { date: formatDate(sub.account.lastScrapedAt) })}
                    >
                      <History className="h-4 w-4 text-muted-foreground shrink-0" />
                    </span>
                  )}
                  {sub.account.accountTypeStatus === 'AWAITING_APPROVAL' && (
                    <Clock
                      className="h-4 w-4 text-yellow-500 shrink-0"
                      xlinkTitle={t('gatedAwaitingApprovalTooltip') || 'Pending Review'}
                    />
                  )}
                  {sub.account.accountTypeStatus === 'CONFIRMED' && sub.account.accountType === 'PERSONAL' && (
                    <Ban
                      className="h-4 w-4 text-destructive shrink-0"
                      xlinkTitle={t('gatedPersonalTooltip') || "Can't be tracked"}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {activeSub && posts.length > 0 && (
            <div className="shrink-0">
              {renderScrapeControl()}
            </div>
          )}
        </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeSub?.activityState === 'NEVER_SCRAPED' && (
          <p className="mb-4 text-sm text-muted-foreground">{t('neverScrapedNote')}</p>
        )}
        {activeSub?.activityState === 'SCRAPE_STALE' && (
          <p className="mb-4 text-sm text-muted-foreground">
            {t('scrapeStaleNote', { date: formatDate(activeSub.account.lastScrapedAt) })}
          </p>
        )}
        {activeSub && (
          <div className="mb-4">
            <ExtractionStatusFilter
              value={statusFilter}
              onChange={setStatusFilter}
              groupLabel={t('extractionStatusFilterLabel')}
              labels={statusLabels}
            />
          </div>
        )}
        {postsLoading || !activeAccountId ? (
          <GridContainer baseCols={1} colsStep={1} gap="gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </GridContainer>
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
        ) : activeSub?.account?.accountTypeStatus === 'AWAITING_APPROVAL' ? (
          <div className="text-center p-16 border rounded-xl border-dashed border-slate-200 dark:border-slate-800 space-y-4 max-w-xl mx-auto">
            <Clock className="h-10 w-10 text-yellow-500 mx-auto animate-pulse" />
            <h3 className="text-lg font-semibold">{t('gatedAwaitingApprovalTitle') || 'Classification Pending'}</h3>
            <p className="text-sm text-muted-foreground">
              {t('gatedAwaitingApprovalDescription') || 'This account is pending review.'}
            </p>
          </div>
        ) : activeSub?.account?.accountTypeStatus === 'CONFIRMED' && activeSub?.account?.accountType === 'PERSONAL' ? (
          <div className="text-center p-16 border rounded-xl border-dashed border-slate-200 dark:border-slate-800 space-y-4 max-w-xl mx-auto">
            <Ban className="h-10 w-10 text-destructive mx-auto" />
            <h3 className="text-lg font-semibold">{t('gatedPersonalTitle') || 'Personal Account'}</h3>
            <p className="text-sm text-muted-foreground">
              {t('gatedPersonalDescription') || "This account can't be tracked."}
            </p>
          </div>
        ) : posts.length === 0 ? (
          statusFilter.length === 1 && statusFilter[0] === 'PENDING' ? (
            <div className="text-center p-16 border rounded-xl border-dashed border-slate-200 dark:border-slate-800 space-y-4">
              <p className="text-muted-foreground font-medium">{t('scrapePostsEmptyStateCta')}</p>
              {renderScrapeControl()}
            </div>
          ) : (
            <div className="text-center p-16 border rounded-xl border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-muted-foreground font-medium">{t('noPostsForStatuses')}</p>
            </div>
          )
        ) : (
          <GridContainer baseCols={1} colsStep={1} gap="gap-4">
            {posts.map((post) => {
              const isSelected = selectedPostIds.includes(post.id as string);
              const status = post.extractionStatus as PostExtractionStatus;
              const isSelectable = status === 'PENDING';
              const quotaReached = selectedPostIds.length >= remainingQuota;
              const isDisabled = !isSelectable || (!isSelected && quotaReached);
              const hoverTitle = !isSelectable
                ? t('nonSelectableHint')
                : !isSelected && quotaReached
                ? 'You have reached your quota limit.'
                : undefined;

              return (
                <div key={post.id} title={hoverTitle}>
                  <PostCard
                    post={{
                      id: post.id as string,
                      accountId: post.accountId as string,
                      content: post.content ?? '',
                      imageUrl: post.imageUrl || undefined,
                      postUrl: post.postUrl,
                      originalPostUrl: post.originalPostUrl || undefined,
                      isExtracted: post.isExtracted,
                      publishedAt: post.publishedAt,
                    }}
                    isSelected={isSelected}
                    onSelectionChange={isSelectable ? () => togglePost(post.id as string) : undefined}
                    disabled={isDisabled}
                    statusBadge={<StatusBadge variant={statusBadgeVariant[status]} label={statusLabels[status]} />}
                    labels={{
                      contentPlaceholder: t('nulledContentPlaceholder') || undefined,
                    }}
                    publisher={
                      activeSub
                        ? {
                            displayName: activeSub.account.displayName,
                            profileImageUrl: activeSub.account.profileImageUrl || undefined,
                            platform: activeSub.account.platform,
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </GridContainer>
        )}
        <div ref={sentinelRef} data-testid="posts-infinite-scroll-sentinel" className="flex justify-center py-4">
          {isFetchingNextPage && (
            <div
              role="status"
              aria-label={t('loadingMorePosts')}
              className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin text-muted-foreground"
            />
          )}
        </div>
      </div>
      </div>

      {/* Summary Bar */}
      <SummaryBar
        selectedCount={selectedPostIds.length}
        quota={remainingQuota}
        isExtracting={isExtracting}
        onExtract={handleExtract}
      />
    </PageContainer>
  );
}
