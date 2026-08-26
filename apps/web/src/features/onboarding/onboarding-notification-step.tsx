'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useWizardStep } from '@festgrid/ui';
import { usePostHog } from '@festgrid/analytics';
import { Switch } from '@/components/ui/switch';
import { graphqlClient } from '@/lib/graphql-client';
import {
  useGetMySettingsQuery,
  useUpdateUserSettingsMutation,
  useRegisterFcmTokenMutation,
} from '@/generated/graphql';
import { requestPushPermissionAndRegister } from '@/lib/push-notifications';

export function OnboardingNotificationStep() {
  const t = useTranslations('OnboardingWizard');
  const posthog = usePostHog();
  const { setStepCompleted } = useWizardStep();

  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const hasInitializedRef = useRef(false);

  // Unconditionally mark step as completed on mount
  useEffect(() => {
    setStepCompleted(true);
  }, [setStepCompleted]);

  // Query settings
  const { data, isLoading } = useGetMySettingsQuery(graphqlClient);

  const { mutateAsync: updateUserSettings } = useUpdateUserSettingsMutation(graphqlClient);
  const { mutateAsync: registerFcmToken } = useRegisterFcmTokenMutation(graphqlClient);

  // Sync settings when loaded
  useEffect(() => {
    if (data?.mySettings && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const dbEnabled = data.mySettings.pushNotificationsEnabled;
      setIsEnabled(dbEnabled === null || dbEnabled === undefined ? true : dbEnabled);
    }
  }, [data]);

  const handleToggleChange = async (checked: boolean) => {
    const previousState = isEnabled;
    // Optimistic UI update
    setIsEnabled(checked);

    try {
      await updateUserSettings({
        input: {
          pushNotificationsEnabled: checked,
        },
      });

      if (checked) {
        // Fire analytics for toggle on
        posthog.capture('push_notifications_enabled');

        // Best effort background push permission request and registration
        try {
          const token = await requestPushPermissionAndRegister();
          if (token) {
            await registerFcmToken({ token });
          } else {
            // Permission denied or registration failed
            toast.error(t('notificationPermissionDeniedToast'));
            posthog.capture('push_notifications_permission_denied');

            // Keep settings synced with browser permission if explicitly denied or unsupported
            const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window;
            const isPermissionDenied = hasNotificationSupport && Notification.permission === 'denied';
            if (isPermissionDenied || !hasNotificationSupport) {
              setIsEnabled(false);
              await updateUserSettings({
                input: {
                  pushNotificationsEnabled: false,
                },
              });
              posthog.capture('push_notifications_disabled');
            }
          }
        } catch (pushErr) {
          console.error('Failed to request push permission and register FCM token:', pushErr);
          toast.error(t('notificationPermissionDeniedToast'));
          posthog.capture('push_notifications_permission_denied');
        }
      } else {
        // Fire analytics for toggle off
        posthog.capture('push_notifications_disabled');
      }
    } catch (err) {
      console.error('Failed to update user settings:', err);
      // Revert optimistic UI
      setIsEnabled(previousState);
      toast.error(t('notificationSaveErrorToast'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-muted rounded" />
        <div className="h-20 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="space-y-1.5 pr-4">
          <h3 className="font-semibold text-base leading-none">
            {t('notificationToggleLabel')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('notificationToggleDescription')}
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggleChange}
          aria-label={t('notificationToggleLabel')}
        />
      </div>
    </div>
  );
}

export default OnboardingNotificationStep;
