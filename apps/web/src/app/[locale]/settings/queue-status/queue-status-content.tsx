"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { useRouter, Link } from "@/i18n/navigation"
import { graphqlClient } from "@/lib/graphql-client"
import { useGetMySubscriptionsQuery, useGetMyApiKeysQuery } from "@/generated/graphql"
import { StatusBadge } from "@festgrid/ui"

export function QueueStatusContent() {
  const t = useTranslations("QueueStatusPage")
  const router = useRouter()
  const { session, isLoading: authLoading } = useAuthSession()

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login")
    }
  }, [authLoading, session, router])

  // Query subscriptions (with pendingExtractionCount)
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
  )

  // Query api keys
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
  )

  const isLoading = subLoading || keysLoading
  const error = subError || keysError

  const refetchAll = () => {
    refetchSubs()
    refetchKeys()
  }

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">
        <div className="h-10 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          <div className="h-20 w-full bg-muted rounded animate-pulse" />
          <div className="h-20 w-full bg-muted rounded animate-pulse" />
          <div className="h-20 w-full bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto text-center space-y-4">
        <p className="text-destructive font-medium">{t("errorState") || "Failed to load queue status"}</p>
        <button
          onClick={refetchAll}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {t("retryButtonLabel") || "Retry"}
        </button>
      </div>
    )
  }

  const subscriptions = subData?.mySubscriptions || []
  const apiKeysList = keysData?.myApiKeys || []

  // Check if any API keys are invalid
  const hasInvalidKey = apiKeysList.some((key) => !key.isValid)

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      {hasInvalidKey && (
        <div className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200 text-sm">
          {t("invalidKeyWarningPrompt")}{" "}
          <Link
            href="/settings/api-keys"
            className="underline font-semibold text-yellow-900 dark:text-yellow-100 hover:text-yellow-950"
          >
            {t("invalidKeyWarningLinkLabel")}
          </Link>
        </div>
      )}

      {/* Subscription Queue Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">{t("subscriptionsSectionTitle")}</h2>
        {subscriptions.length === 0 ? (
          <div className="border rounded-lg p-6 bg-card text-center text-muted-foreground text-sm">
            {t("emptyState")}
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden bg-card">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-semibold block">{sub.account.displayName || sub.account.username}</span>
                  <span className="text-xs text-muted-foreground">@{sub.account.username}</span>
                </div>
                <div className="text-sm font-medium">
                  {t("pendingCountLabel", { count: sub.pendingExtractionCount })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Key Health Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">{t("apiKeysSectionTitle")}</h2>
        {apiKeysList.length === 0 ? (
          <div className="border rounded-lg p-6 bg-card text-center text-muted-foreground text-sm">
            {t("noApiKeysConfigured")}
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden bg-card">
            {apiKeysList.map((key) => (
              <div key={key.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-semibold block uppercase">{key.provider}</span>
                  <span className="text-xs text-muted-foreground font-mono">{key.maskedKey}</span>
                </div>
                <div>
                  <StatusBadge
                    variant={key.isValid ? "active" : "invalid"}
                    label={
                      key.isValid
                        ? t("activeStatusLabel") || "Active"
                        : t("invalidStatusLabel") || "Invalid"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
