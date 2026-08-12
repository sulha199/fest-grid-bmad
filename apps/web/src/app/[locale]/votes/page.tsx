"use client"

import React, { useState } from "react"
import { RankedVoteList } from "@/components/votes/RankedVoteList"
import { CastVoteForm } from "@/components/votes/CastVoteForm"
import { useGetMyLocationsQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { Coordinates } from "@festgrid/shared-types"

export default function VotesPage() {
  const [isVoteFormOpen, setIsVoteFormOpen] = useState(false)
  const [nearMe, setNearMe] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)

  const { data: locationData } = useGetMyLocationsQuery(graphqlClient, {}, { enabled: nearMe })

  const locations = locationData?.myLocations || []

  // Auto-select first location if none is selected and we have some
  React.useEffect(() => {
    if (nearMe && locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id)
    }
  }, [nearMe, locations, selectedLocationId])

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Community Account Votes</h1>
          <p className="text-muted-foreground mt-1">
            Register demand for social media accounts you would like to see subscribed!
          </p>
        </div>
        <button
          onClick={() => setIsVoteFormOpen(true)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 self-start sm:self-center"
        >
          Request New Account
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-card gap-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={nearMe}
            onCheckedChange={(checked) => {
              setNearMe(checked)
              if (!checked) setSelectedLocationId(null)
            }}
          />
          <div>
            <span className="font-semibold text-foreground block">Proximity Weighting</span>
            <span className="text-xs text-muted-foreground block">
              Prioritize accounts popular near your saved locations
            </span>
          </div>
        </div>

        {nearMe && (
          <div className="w-full sm:w-60 space-y-1">
            <label className="text-xs text-muted-foreground">Select Saved Location</label>
            <Select
              value={selectedLocationId || ""}
              onValueChange={setSelectedLocationId}
              disabled={locations.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={locations.length === 0 ? "No saved locations found" : "Select saved location"} />
              </SelectTrigger>
              <SelectContent className="bg-background border">
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.locationDetails.placeName || "Resolved"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <RankedVoteList nearMe={nearMe} selectedLocationId={selectedLocationId} />

      <CastVoteForm isOpen={isVoteFormOpen} onClose={() => setIsVoteFormOpen(false)} />
    </div>
  )
}
