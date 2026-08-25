"use client"

import { useEffect, useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { useRouter } from "@/i18n/navigation"
import { graphqlClient } from "@/lib/graphql-client"
import {
  useGetMySettingsQuery,
  useUpdateUserSettingsMutation,
  useRegisterFcmTokenMutation,
} from "@/generated/graphql"
import { Switch } from "@/components/ui/switch"
import { usePostHog } from "@festgrid/analytics"
import { requestPushPermissionAndRegister } from "@/lib/push-notifications"
import { PageContainer, PageHeader } from "@festgrid/ui"

export function NotificationsContent() {
  const t = useTranslations("NotificationsSettingsPage")
  const router = useRouter()
  const posthog = usePostHog()
  const { session, isLoading: authLoading } = useAuthSession()

  const [isEnabled, setIsEnabled] = useState<boolean>(false)

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login")
    }
  }, [authLoading, session, router])

  // Query settings
  const { data, isLoading, error, refetch } = useGetMySettingsQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  )

  const { mutateAsync: updateUserSettings } = useUpdateUserSettingsMutation(graphqlClient)
  const { mutateAsync: registerFcmToken } = useRegisterFcmTokenMutation(graphqlClient)

  const hasInitializedRef = useRef(false)

  // Sync settings when loaded
  useEffect(() => {
    if (data?.mySettings && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      const dbEnabled = data.mySettings.pushNotificationsEnabled
      const finalEnabled = dbEnabled === null || dbEnabled === undefined ? true : dbEnabled

      // Check browser capabilities and permission
      const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window
      const isPermissionDenied = hasNotificationSupport && Notification.permission === 'denied'
      const isNotSupported = typeof window !== 'undefined' && !hasNotificationSupport

      // If push notifications are not supported or explicitly denied, force setting to false to keep synced
      if (finalEnabled && (isPermissionDenied || isNotSupported)) {
        setIsEnabled(false)
        updateUserSettings({
          input: {
            pushNotificationsEnabled: false,
          },
        }).catch((err) => {
          console.error("Failed to sync push notification setting with denied browser permission:", err)
        })
        return
      }

      setIsEnabled(finalEnabled)

      // If settings was not set, make push-notification on as default
      if (dbEnabled === null || dbEnabled === undefined) {
        updateUserSettings({
          input: {
            pushNotificationsEnabled: true,
          },
        }).catch((err) => {
          console.error("Failed to save default push notification setting:", err)
        })
      }

      // Start related service worker based on the push notification settings
      if (finalEnabled) {
        const startServiceWorker = async () => {
          try {
            const token = await requestPushPermissionAndRegister()
            if (token) {
              await registerFcmToken({ token })
            } else {
              // If permission explicitly denied during best-effort start, keep it synced by disabling it
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
                setIsEnabled(false)
                await updateUserSettings({
                  input: {
                    pushNotificationsEnabled: false,
                  },
                })
                posthog.capture("push_notifications_disabled")
              }
            }
          } catch (err) {
            console.error("Failed to auto-start service worker and register FCM token:", err)
          }
        }
        startServiceWorker()
      }
    }
  }, [data?.mySettings, updateUserSettings, registerFcmToken, posthog])

  const handleToggleChange = async (checked: boolean) => {
    // Optimistic UI update
    const previousState = isEnabled
    setIsEnabled(checked)

    try {
      await updateUserSettings({
        input: {
          pushNotificationsEnabled: checked,
        },
      })

      if (checked) {
        // Fire analytics for toggle on
        posthog.capture("push_notifications_enabled")

        // Best effort background push permission request and registration
        try {
          const token = await requestPushPermissionAndRegister()
          if (token) {
            await registerFcmToken({ token })
          } else {
            // Permission denied or registration failed
            const { toast } = await import("sonner")
            toast.error(t("permissionDeniedToast"))
            posthog.capture("push_notifications_permission_denied")

            // Keep settings synced with browser permission if explicitly denied or unsupported
            const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window
            const isPermissionDenied = hasNotificationSupport && Notification.permission === 'denied'
            if (isPermissionDenied || !hasNotificationSupport) {
              setIsEnabled(false)
              await updateUserSettings({
                input: {
                  pushNotificationsEnabled: false,
                },
              })
              posthog.capture("push_notifications_disabled")
            }
          }
        } catch (pushErr) {
          console.error("Failed to request push permission and register FCM token:", pushErr)
          const { toast } = await import("sonner")
          toast.error(t("permissionDeniedToast"))
          posthog.capture("push_notifications_permission_denied")
        }
      } else {
        // Fire analytics for toggle off
        posthog.capture("push_notifications_disabled")
      }
    } catch (err) {
      console.error("Failed to update user settings:", err)
      // Revert optimistic UI
      setIsEnabled(previousState)
      const { toast } = await import("sonner")
      toast.error(t("saveErrorToast"))
    }
  }

  if (authLoading || isLoading) {
    return (
      <PageContainer fullWidth={false}>
        <div className="h-10 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          <div className="h-24 w-full bg-muted rounded animate-pulse" />
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer fullWidth={false} className="text-center space-y-4">
        <p className="text-destructive font-medium">{t("errorState")}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {t("retryButtonLabel")}
        </button>
      </PageContainer>
    )
  }

  return (
    <PageContainer fullWidth={false}>
      <PageHeader title={t("title")} />

      <div className="flex items-start justify-between p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="space-y-1.5 pr-4">
          <h2 className="font-semibold text-lg leading-none">{t("toggleLabel")}</h2>
          <p className="text-sm text-muted-foreground">{t("toggleDescription")}</p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggleChange}
          aria-label={t("toggleLabel")}
        />
      </div>
    </PageContainer>
  )
}
