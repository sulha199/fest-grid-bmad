"use client"

import React, { useState } from "react"
import { useRankedVoteAccountsQuery, useCastVoteMutation } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { getPlatformDisplayName } from "@festgrid/domain/scraper"
import { RegionBreakdownSheet } from "./RegionBreakdownSheet"

interface RankedVoteListProps {
  nearMe: boolean
  selectedLocationId: string | null
}

export function RankedVoteList({ nearMe, selectedLocationId }: RankedVoteListProps) {
  const queryClient = useQueryClient()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)

  const { data, isLoading, refetch } = useRankedVoteAccountsQuery(
    graphqlClient,
    {
      nearMe,
      locationPreferenceId: selectedLocationId,
    }
  )

  const { mutateAsync: castVote, isPending: isVoting } = useCastVoteMutation(graphqlClient)

  const handleVote = async (accountId: string) => {
    try {
      await castVote({
        input: { accountId },
      })
      toast.success("Vote recorded successfully!")
      queryClient.invalidateQueries({ queryKey: ["rankedVoteAccounts"] })
      refetch()
    } catch {
      toast.error("Failed to record vote")
    }
  }

  const items = data?.rankedVoteAccounts || []

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-24 bg-card border rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">
        No voted accounts found matching the criteria.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((entry, index) => {
          const profile = entry.profile
          return (
            <div
              key={profile.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border rounded-lg bg-card hover:shadow-sm transition-shadow gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl font-extrabold text-muted-foreground w-8">
                  #{index + 1}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{profile.displayName}</h3>
                  <p className="text-sm text-muted-foreground">
                    @{profile.username} • {getPlatformDisplayName(profile.platform as any)}
                  </p>
                  {profile.description && (
                    <p className="text-sm text-foreground/80 mt-1 line-clamp-1">{profile.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground block">{entry.voteCount}</span>
                  <span className="text-xs text-muted-foreground block">votes</span>
                </div>

                <button
                  onClick={() => handleVote(profile.id)}
                  disabled={isVoting}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 disabled:opacity-50"
                >
                  Vote
                </button>

                <button
                  onClick={() => {
                    setSelectedAccountId(profile.id)
                    setIsBreakdownOpen(true)
                  }}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
                >
                  Regions
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <RegionBreakdownSheet
        accountId={selectedAccountId}
        isOpen={isBreakdownOpen}
        onClose={() => {
          setIsBreakdownOpen(false)
          setSelectedAccountId(null)
        }}
      />
    </>
  )
}
