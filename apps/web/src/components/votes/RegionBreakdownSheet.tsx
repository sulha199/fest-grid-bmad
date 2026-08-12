"use client"

import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useVoteRegionBreakdownQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"

interface RegionBreakdownSheetProps {
  accountId: string | null
  isOpen: boolean
  onClose: () => void
}

export function RegionBreakdownSheet({ accountId, isOpen, onClose }: RegionBreakdownSheetProps) {
  const { data, isLoading } = useVoteRegionBreakdownQuery(
    graphqlClient,
    { accountId: accountId || "" },
    { enabled: isOpen && !!accountId }
  )

  const items = data?.voteRegionBreakdown || []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="bg-background border-l w-full sm:max-w-md p-6 overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold">Region Breakdown</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground animate-pulse">
            Loading breakdown...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No geographic data available (regions with fewer than 5 voters are hidden).
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between border-b pb-3">
                <span className="font-medium text-foreground">{bucket.label}</span>
                <span className="text-sm font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {bucket.voterCount} votes
                </span>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
