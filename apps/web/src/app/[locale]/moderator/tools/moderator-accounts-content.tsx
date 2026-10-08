'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RouteLoader, BlockingLoader, Checkbox, AccountLocationField, ConfirmActionDialog } from '@festgrid/ui';
import { useRequireModerator } from '@/features/auth/use-require-moderator';
import { usePostHog } from '@festgrid/analytics';
import { toast } from 'sonner';
import { useQueryModeratorAccountProfiles, useSetImageStorageOptInMutation, useClearAccountDefaultLocationMutation } from './moderator-accounts-hooks';
import { SetDefaultLocationDialog } from '../../settings/account/set-default-location-dialog';
import type { ModeratorAccountProfileFilters } from '@/gql/graphql';
import { Button } from '@festgrid/ui';

export function ModeratorAccountsContent() {
  const t = useTranslations('ModeratorAccountsPage');
  const posthog = usePostHog();
  const { status: authStatus } = useRequireModerator();
  const [searchTerm, setSearchInput] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [updatingAccounts, setUpdatingAccounts] = useState<{ [key: string]: boolean }>({});
  const [locationDialogState, setLocationDialogState] = useState<{
    accountId: string;
    mode: 'set' | 'edit';
    initialLocation?: { formattedAddress?: string; placeName?: string };
  } | null>(null);
  const [clearingAccountId, setClearingAccountId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const filters: ModeratorAccountProfileFilters = { search: searchTerm.trim() || undefined };
  const { data: accountsData, isLoading: isLoadingAccounts, error: accountsError, refetch: refetchAccounts } = useQueryModeratorAccountProfiles(filters, cursor, 20, authStatus === 'authorized');
  const { mutateAsync: setImageStorageOptIn } = useSetImageStorageOptInMutation();
  const { mutateAsync: clearAccountDefaultLocation } = useClearAccountDefaultLocationMutation();

  if (authStatus === 'loading' || authStatus === 'unauthenticated' || authStatus === 'unauthorized') return <RouteLoader />;
  if (isLoadingAccounts) return <RouteLoader />;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCursor(undefined);
  };

  const handleToggleOptIn = async (accountId: string, displayName: string, checked: boolean) => {
    setUpdatingAccounts((prev) => ({ ...prev, [accountId]: true }));
    try {
      await setImageStorageOptIn({ accountId, optedIn: checked });
      posthog.capture('moderator_image_storage_opt_in_toggled', { accountId, optedIn: checked });
      toast.success(checked ? t('optInSuccessToast', { name: displayName }) : t('optOutSuccessToast', { name: displayName }));
      refetchAccounts();
    } catch (error) {
      toast.error(t('toggleErrorToast', { name: displayName }));
    } finally {
      setUpdatingAccounts((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const handleLocationSaved = (accountId: string, mode: 'set' | 'edit') => {
    posthog.capture(
      mode === 'edit' ? 'moderator_accounts_tab_default_location_edited' : 'moderator_accounts_tab_default_location_set',
      { accountId }
    );
    refetchAccounts();
  };

  const handleConfirmClear = async () => {
    if (!clearingAccountId) return;
    setIsClearing(true);
    try {
      await clearAccountDefaultLocation({ accountId: clearingAccountId });
      posthog.capture('moderator_accounts_tab_default_location_cleared', { accountId: clearingAccountId });
      toast.success(t('defaultLocationClearedToast'));
      setClearingAccountId(null);
      refetchAccounts();
    } catch (error) {
      toast.error(t('defaultLocationClearErrorToast'));
    } finally {
      setIsClearing(false);
    }
  };

  const queryResult = accountsData?.queryModeratorAccountProfiles;
  const edges = queryResult?.edges || [];
  const hasNextPage = queryResult?.pageInfo?.hasNextPage || false;
  const isEmpty = edges.length === 0 && !cursor;
  const isAnyToggleInProgress = Object.values(updatingAccounts).some((v) => v);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="account-search" className="text-sm font-medium">{t('searchLabel')}</label>
        <input id="account-search" type="text" value={searchTerm} onChange={handleSearchChange} placeholder={t('searchPlaceholder')} className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
      </div>
      {!!accountsError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <div className="text-destructive">✕</div>
            <div>
              <h3 className="font-semibold">{t('errorHeadline')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{(accountsError as any)?.message || t('unknownError')}</p>
            </div>
          </div>
          <button onClick={() => refetchAccounts()} className="mt-4 text-sm font-medium text-primary hover:underline focus:outline-none">{t('errorTryAgain')}</button>
        </div>
      )}
      {isEmpty && !accountsError && (
        <div className="py-12 text-center">
          <h3 className="text-lg font-semibold">{t('emptyHeadline')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t('emptyMessage')}</p>
        </div>
      )}
      {!isEmpty && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border divide-y divide-border">
            {edges.map((edge) => {
              const account = edge.node as any;
              return (
                <div key={account.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{account.displayName}</h4>
                      <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 uppercase dark:bg-violet-900 dark:text-violet-100">{account.platform}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">@{account.username}</p>
                    <div className="mt-1 text-xs">
                      {account.defaultLocation ? (
                        <AccountLocationField
                          location={account.defaultLocation}
                          isPendingReview={!!account.hasPendingDefaultLocationReview}
                          onEdit={() => setLocationDialogState({
                            accountId: account.id,
                            mode: 'edit',
                            // GraphQL gives `null` for absent fields; the dialog's prop type wants `undefined`.
                            initialLocation: account.defaultLocation
                              ? {
                                  formattedAddress: account.defaultLocation.formattedAddress ?? undefined,
                                  placeName: account.defaultLocation.placeName ?? undefined,
                                }
                              : undefined,
                          })}
                          onClear={() => setClearingAccountId(account.id)}
                          labels={{
                            editLabel: t('editDefaultLocationLabel'),
                            pendingReviewLabel: t('pendingReviewBadgeLabel'),
                            clearLabel: t('clearDefaultLocationLabel'),
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setLocationDialogState({ accountId: account.id, mode: 'set' })}
                          className="text-primary hover:underline font-medium"
                        >
                          {t('setDefaultLocationLabel')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Checkbox id={`opt-in-${account.id}`} label={t('optedInLabel')} checked={account.isImageStorageOptedIn} onChange={(checked) => handleToggleOptIn(account.id, account.displayName, checked)} disabled={updatingAccounts[account.id] || false} />
                  </div>
                </div>
              );
            })}
          </div>
          {hasNextPage && <Button onClick={() => setCursor(queryResult?.pageInfo?.endCursor || undefined)} variant="outline" className="w-full">{t('loadMoreButton')}</Button>}
        </div>
      )}

      <SetDefaultLocationDialog
        accountId={locationDialogState?.accountId ?? null}
        isOpen={locationDialogState !== null}
        onClose={() => setLocationDialogState(null)}
        mode={locationDialogState?.mode ?? 'set'}
        initialLocation={locationDialogState?.initialLocation}
        asModeratorCorrection
        onSaved={() => {
          if (locationDialogState) handleLocationSaved(locationDialogState.accountId, locationDialogState.mode);
        }}
      />

      <ConfirmActionDialog
        open={clearingAccountId !== null}
        title={t('clearLocationConfirmTitle')}
        description={t('clearLocationConfirmDescription')}
        confirmLabel={t('clearLocationConfirmLabel')}
        cancelLabel={t('clearLocationCancelLabel')}
        confirmVariant="destructive"
        onConfirm={handleConfirmClear}
        onCancel={() => setClearingAccountId(null)}
      />

      <BlockingLoader active={isAnyToggleInProgress || isClearing} />
    </div>
  );
}
