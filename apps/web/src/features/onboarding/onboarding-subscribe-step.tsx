'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BlockingLoader, useWizardStep } from '@festgrid/ui';
import { usePostHog } from '@festgrid/analytics';
import { SUPPORTED_PLATFORMS, parseSocialMediaAccountHandle } from '@festgrid/domain/subscriptions';
import { getPlatformDisplayName } from '@festgrid/domain/scraper';
import { useGetMySubscriptionsQuery, useSubscribeToAccountMutation } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useQueryClient } from '@tanstack/react-query';
import { ClientError } from 'graphql-request';

export function OnboardingSubscribeStep() {
  const t = useTranslations('OnboardingWizard');
  const posthog = usePostHog();
  const { setStepCompleted } = useWizardStep();
  const queryClient = useQueryClient();

  const { data: subscriptionsData, isLoading: isLoadingSubscriptions } = useGetMySubscriptionsQuery(graphqlClient);
  const { mutateAsync: subscribeToAccount, isPending: isSaving } = useSubscribeToAccountMutation(graphqlClient);

  const [platform, setPlatform] = useState<string>(SUPPORTED_PLATFORMS[0]);
  const [handleInput, setHandleInput] = useState('');

  const subscriptions = subscriptionsData?.mySubscriptions ?? [];
  const hasExistingSubscriptions = subscriptions.length > 0;

  useEffect(() => {
    if (hasExistingSubscriptions) {
      setStepCompleted(true);
    }
  }, [hasExistingSubscriptions, setStepCompleted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = parseSocialMediaAccountHandle(handleInput);
    if (!cleanHandle) {
      toast.error(t('invalidHandleError'));
      return;
    }

    try {
      const result = await subscribeToAccount({
        input: {
          platform,
          accountId: cleanHandle,
          username: cleanHandle,
          displayName: cleanHandle,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['getMySubscriptions'] });
      posthog.capture('wizard_subscribe_step_completed', { platform });
      setHandleInput('');
      setPlatform(SUPPORTED_PLATFORMS[0]);
      setStepCompleted(true);

      if (result.subscribeToAccount.alreadySubscribed) {
        toast.info(t('alreadySubscribedToast'));
      } else {
        toast.success(t('subscribeSuccessToast'));
      }
    } catch (err: any) {
      if (err instanceof ClientError) {
        const firstError = err.response?.errors?.[0];
        if (firstError?.extensions?.code === 'SCRAPER_CAPACITY_EXCEEDED') {
          toast.error('Apify usage is temporarily at capacity. New subscriptions are paused until the next cycle reset.');
          return;
        }
      }

      toast.error(t('subscribeErrorToast'));
    }
  };

  return (
    <div className="space-y-6">
      <BlockingLoader active={isSaving} label={t('savingLabel')} />

      {hasExistingSubscriptions && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          {subscriptions.map((subscription: any) => {
            const account = subscription.account;
            const label = account?.displayName || account?.username || subscription.accountId;
            return (
              <div key={subscription.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{getPlatformDisplayName(account?.platform || platform)}</span>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="platform-select" className="text-sm font-medium text-gray-700 block">
            {t('platformLabel')}
          </label>
          <select
            id="platform-select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {SUPPORTED_PLATFORMS.map((plat) => (
              <option key={plat} value={plat}>
                {getPlatformDisplayName(plat)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="account-handle-input" className="text-sm font-medium text-gray-700 block">
            {t('accountLabel')}
          </label>
          <input
            id="account-handle-input"
            type="text"
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            placeholder={t('accountPlaceholder')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            required
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving || !handleInput.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2"
          >
            {t('subscribeSubmitLabel')}
          </button>
        </div>
      </form>
    </div>
  );
}
export default OnboardingSubscribeStep;
