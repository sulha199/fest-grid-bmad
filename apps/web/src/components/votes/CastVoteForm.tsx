"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BlockingLoader } from "@festgrid/ui"
import { usePostHog } from "@festgrid/analytics"
import { SUPPORTED_PLATFORMS, parseSocialMediaAccountHandle } from "@festgrid/domain/subscriptions"
import { getPlatformDisplayName } from "@festgrid/domain/scraper"
import { useCastVoteMutation } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryClient } from "@tanstack/react-query"

interface CastVoteFormProps {
  isOpen: boolean
  onClose: () => void
}

export function CastVoteForm({ isOpen, onClose }: CastVoteFormProps) {
  const queryClient = useQueryClient()
  const posthog = usePostHog()

  const { mutateAsync: castVote, isPending: isSaving } = useCastVoteMutation(graphqlClient)

  const [platform, setPlatform] = useState<string>(SUPPORTED_PLATFORMS[0])
  const [handleInput, setHandleInput] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanHandle = parseSocialMediaAccountHandle(handleInput)
    if (!cleanHandle) {
      toast.error("Invalid account handle")
      return
    }

    try {
      await castVote({
        input: {
          platform,
          handleOrUrl: cleanHandle,
        },
      })

      posthog.capture("vote_cast", { platform })
      await queryClient.invalidateQueries({ queryKey: ["rankedVoteAccounts"] })

      toast.success("Successfully voted!")
      setHandleInput("")
      onClose()
    } catch (err: any) {
      toast.error("Failed to cast vote")
    }
  }

  return (
    <>
      <BlockingLoader active={isSaving} label="Voting..." />

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Vote for a Social Media Account</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">
                  Platform
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">
                  Account Handle
                </label>
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="e.g. handle or profile URL"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !handleInput.trim()}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2"
              >
                Vote
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
