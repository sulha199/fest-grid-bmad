"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { SwipeToReveal, useSoftDeleteWithUndo } from "@festgrid/ui"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { useRouter, Link } from "@/i18n/navigation"
import { graphqlClient } from "@/lib/graphql-client"
import { useGetMySubscriptionsQuery, useRemoveSubscriptionMutation, SoftDeleteAction } from "@/generated/graphql"
import { useHasApiKey } from "@/features/onboarding/use-has-api-key"
import { SubscribeAccountDialog } from "./subscribe-account-dialog"
import { Plus, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { usePostHog } from "@festgrid/analytics"

export function SubscriptionsContent() {
  const t = useTranslations("SubscriptionsPage")
  const router = useRouter()
  const queryClient = useQueryClient()
  const posthog = usePostHog()
  const { session, isLoading: authLoading } = useAuthSession()
  const hasApiKey = useHasApiKey()

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login")
    }
  }, [authLoading, session, router])

  // Query subscriptions
  const { data, isLoading, error, refetch } = useGetMySubscriptionsQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  )

  const { mutateAsync: removeSubscription } = useRemoveSubscriptionMutation(graphqlClient)
  const { isPending, markPending } = useSoftDeleteWithUndo<string>({
    onExpire: (id) => {
      queryClient.setQueryData(["getMySubscriptions"], (old: any) => {
        if (!old) return old
        return {
          ...old,
          mySubscriptions: (old.mySubscriptions || []).filter((sub: any) => sub.id !== id),
        }
      })
    },
  })

  const subscriptions = (data?.mySubscriptions || [])

  const handleOpenAddDialog = () => {
    setIsDialogOpen(true)
  }

  const handleDelete = async (subscription: any) => {
    try {
      await removeSubscription({
        id: subscription.id,
        action: SoftDeleteAction.Delete,
      })

      posthog.capture("subscription_removed", {
        subscriptionId: subscription.id,
      })

      markPending(
        subscription.id,
        async () => {
          try {
            await removeSubscription({
              id: subscription.id,
              action: SoftDeleteAction.Restore,
            })
          } catch (err) {
            console.error("Failed to restore subscription", err)
            throw err
          }
        },
        {
          message: t("removeButtonLabel") === "Hapus" ? "Langganan dihapus" : "Subscription removed",
          undoLabel: t("undoLabel") || "Undo",
        }
      )
    } catch (err) {
      console.error("Failed to delete subscription", err)
      const { toast: sonnerToast } = await import("sonner")
      sonnerToast.error(t("removeErrorAnnouncement") || "Failed to delete subscription")
    }
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
        <p className="text-destructive font-medium">{t("errorState") || "Failed to load subscriptions"}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        {hasApiKey && subscriptions.length > 0 && (
          <button
            onClick={handleOpenAddDialog}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("addButtonLabel")}</span>
          </button>
        )}
      </div>

      {!hasApiKey && (
        <div className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200 text-sm">
          {t("noApiKeyPrompt")}{" "}
          <Link href="/settings/api-keys" className="underline font-semibold text-yellow-900 dark:text-yellow-100 hover:text-yellow-950">
            {t("noApiKeyLinkLabel")}
          </Link>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center space-y-4">
          <p className="text-muted-foreground">{t("emptyState")}</p>
          {hasApiKey && (
            <button
              onClick={handleOpenAddDialog}
              className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              <Plus className="h-4 w-4" />
              {t("addButtonLabel")}
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden bg-card">
          {subscriptions.map((sub) => {
            const pending = isPending(sub.id)

            return (
              <SwipeToReveal
                key={sub.id}
                disabled={pending}
                action={
                  <div className="bg-destructive text-destructive-foreground h-full px-6 flex items-center gap-2 font-medium">
                    <Trash2 className="h-4 w-4" />
                    <span>{t("removeButtonLabel") || "Remove"}</span>
                  </div>
                }
                onAction={() => handleDelete(sub)}
              >
                <div
                  className={`flex items-center justify-between p-4 bg-background transition-opacity ${
                    pending ? "opacity-40 pointer-events-none" : ""
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                    {sub.account.profileImageUrl ? (
                      <img
                        src={sub.account.profileImageUrl}
                        alt={sub.account.displayName || sub.account.username}
                        className="h-10 w-10 rounded-full object-cover shrink-0 border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold shrink-0">
                        {sub.account.displayName?.charAt(0).toUpperCase() || sub.account.username?.charAt(0).toUpperCase() || "S"}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{sub.account.displayName || sub.account.username}</h3>
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0">
                          {sub.account.platform === "twitter" ? "Twitter/X" : sub.account.platform.charAt(0).toUpperCase() + sub.account.platform.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        @{sub.account.username}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(sub)}
                      disabled={pending}
                      className="p-2 hover:bg-accent text-destructive hover:text-destructive-foreground rounded-md transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </SwipeToReveal>
            )
          })}
        </div>
      )}

      {hasApiKey && (
        <SubscribeAccountDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  )
}
