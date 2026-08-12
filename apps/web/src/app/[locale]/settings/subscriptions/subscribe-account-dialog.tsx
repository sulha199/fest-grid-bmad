"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BlockingLoader, useDebounce } from "@festgrid/ui"
import { usePostHog } from "@festgrid/analytics"
import { SUPPORTED_PLATFORMS, parseSocialMediaAccountHandle } from "@festgrid/domain/subscriptions"
import { getPlatformDisplayName } from "@festgrid/domain/scraper"
import { useSubscribeToAccountMutation, useVotedAccountSuggestionsQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryClient } from "@tanstack/react-query"

interface SubscribeAccountDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SubscribeAccountDialog({ isOpen, onClose }: SubscribeAccountDialogProps) {
  const t = useTranslations("SubscriptionsPage")
  const queryClient = useQueryClient()
  const posthog = usePostHog()

  const { mutateAsync: subscribeToAccount, isPending: isSaving } = useSubscribeToAccountMutation(graphqlClient)

  const [platform, setPlatform] = useState<string>(SUPPORTED_PLATFORMS[0])
  const [handleInput, setHandleInput] = useState("")
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)

  const debouncedSearch = useDebounce(handleInput, 300)

  const { data: suggestionsData, isLoading: isSuggestionsLoading } = useVotedAccountSuggestionsQuery(
    graphqlClient,
    { query: debouncedSearch },
    {
      enabled: isOpen && debouncedSearch.trim().length >= 2,
    }
  )

  const suggestions = suggestionsData?.votedAccountSuggestions || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanHandle = parseSocialMediaAccountHandle(handleInput)
    if (!cleanHandle) {
      toast.error(t("subscribeErrorToast") || "Invalid account handle")
      return
    }

    try {
      const result = await subscribeToAccount({
        input: {
          platform,
          accountId: cleanHandle,
          username: cleanHandle,
          displayName: cleanHandle,
        },
      })

      posthog.capture("subscription_added", { platform })
      await queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] })

      if (result.subscribeToAccount.alreadySubscribed) {
        toast.info(t("alreadySubscribedToast") || "Already subscribed to this account")
      } else {
        toast.success(t("subscribeSuccessToast") || "Successfully subscribed!")
      }

      setHandleInput("")
      onClose()
    } catch {
      toast.error(t("subscribeErrorToast") || "Failed to subscribe")
    }
  }

  return (
    <>
      <BlockingLoader active={isSaving} label={t("savingLabel") || "Subscribing..."} />

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("addModalTitle")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">
                  {t("platformLabel")}
                </label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border">
                    {SUPPORTED_PLATFORMS.map((plat) => (
                      <SelectItem key={plat} value={plat}>
                        {getPlatformDisplayName(plat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-foreground block">
                  {t("accountLabel")}
                </label>
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => {
                    setHandleInput(e.target.value)
                    setIsSuggestionsOpen(true)
                  }}
                  onFocus={() => setIsSuggestionsOpen(true)}
                  placeholder={t("accountPlaceholder")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />

                {isSuggestionsOpen && handleInput.trim().length >= 2 && (
                  <div className="absolute z-50 w-full rounded-md border border-input bg-background shadow-md max-h-60 overflow-y-auto mt-1 p-1">
                    {isSuggestionsLoading ? (
                      <div className="text-xs text-muted-foreground p-3 text-center animate-pulse">
                        Searching suggestions...
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-3 text-center">
                        No matching voted accounts found
                      </div>
                    ) : (
                      suggestions.map((entry: any) => {
                        const profile = entry.profile
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => {
                              setPlatform(profile.platform)
                              setHandleInput(profile.username)
                              setIsSuggestionsOpen(false)
                              toast.info(`Selected voted account: @${profile.username}`)
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded hover:bg-accent text-left text-sm text-foreground transition-colors"
                          >
                            <div>
                              <span className="font-semibold block">{profile.displayName}</span>
                              <span className="text-xs text-muted-foreground block">
                                @{profile.username} • {getPlatformDisplayName(profile.platform)}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {entry.voteCount} votes
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                {t("cancelButtonLabel") || "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isSaving || !handleInput.trim()}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2"
              >
                {t("subscribeSubmitLabel") || "Subscribe"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
