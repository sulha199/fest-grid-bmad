'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BlockingLoader, useWizardStep } from '@festgrid/ui';
import { usePostHog } from '@festgrid/analytics';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMyApiKeysQuery, useCreateApiKeyMutation } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export function OnboardingApiKeyStep() {
  const t = useTranslations('OnboardingWizard');
  const posthog = usePostHog();
  const { setStepCompleted } = useWizardStep();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetMyApiKeysQuery(graphqlClient);
  const { mutateAsync: createApiKey, isPending: isSaving } = useCreateApiKeyMutation(graphqlClient);
  const [apiKeyVal, setApiKeyVal] = useState('');

  const hasExistingKey = (data?.myApiKeys.length ?? 0) > 0;

  useEffect(() => {
    if (hasExistingKey) {
      setStepCompleted(true);
    }
  }, [hasExistingKey, setStepCompleted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyVal.trim()) return;

    try {
      const result = await createApiKey({
        input: {
          provider: 'gemini',
          key: apiKeyVal.trim(),
        },
      });

      queryClient.setQueriesData({ queryKey: ['GetMyApiKeys'] }, (old: any) => {
        if (!old) return { myApiKeys: [result.createApiKey] };
        return {
          ...old,
          myApiKeys: [result.createApiKey, ...(old.myApiKeys || [])],
        };
      });

      posthog.capture('wizard_api_key_step_completed');
      setStepCompleted(true);
      toast.success(t('apiKeySuccessToast'));
      setApiKeyVal('');
    } catch (err: any) {
      toast.error(t('apiKeyErrorToast'));
    }
  };

  if (isLoading) {
    return <div className="h-20 flex items-center justify-center text-sm text-gray-500">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <BlockingLoader active={isSaving} label={t('savingLabel')} />

      {hasExistingKey && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-md">
          {t('apiKeyAlreadyHaveOne')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="api-key-input" className="text-sm font-medium text-gray-700 block">
            {t('apiKeyLabel')}
          </label>
          <input
            id="api-key-input"
            type="password"
            value={apiKeyVal}
            onChange={(e) => setApiKeyVal(e.target.value)}
            placeholder={t('apiKeyPlaceholder')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            required={!hasExistingKey}
          />
        </div>

        <div className="flex items-center justify-between">
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-500"
          >
            {t('howToGetKeyLinkLabel')}
          </a>

          <button
            type="submit"
            disabled={isSaving || !apiKeyVal.trim()}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 py-2"
          >
            {t('apiKeySubmitLabel')}
          </button>
        </div>
      </form>
    </div>
  );
}
export default OnboardingApiKeyStep;
