"use client"

import React from "react"
import { StatusBadge } from "@festgrid/ui"
import { useTranslations } from "next-intl"

export interface PendingLocationChange {
  id: string
  accountId: string
  status: string
  createdAt: string
  account: {
    id: string
    displayName: string
    platform: string
    username: string
    profileImageUrl?: string | null
  }
  previousLocation?: {
    placeName?: string | null
    formattedAddress?: string | null
    coordinates: {
      lat: number
      lng: number
    }
  } | null
  newLocation: {
    placeName?: string | null
    formattedAddress?: string | null
    coordinates: {
      lat: number
      lng: number
    }
  }
}

interface PendingLocationChangeRowProps {
  change: PendingLocationChange
  onResolve: (id: string, action: "ACCEPT" | "REVERT") => Promise<void>
}

export function PendingLocationChangeRow({ change, onResolve }: PendingLocationChangeRowProps) {
  const t = useTranslations("ModeratorItemsPage")
  const tStatus = useTranslations("DefaultLocationChangeStatus")

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = "none"
  }

  const prevLocText = change.previousLocation?.formattedAddress || change.previousLocation?.placeName || "Unknown"
  const newLocText = change.newLocation.formattedAddress || change.newLocation.placeName || "Unknown"

  return (
    <div className="p-4 sm:p-6 border rounded-lg bg-card shadow-sm space-y-4 flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-6">
      <div className="space-y-3 flex-1">
        <div className="flex items-center space-x-3">
          {change.account.profileImageUrl ? (
            <img
              src={change.account.profileImageUrl}
              alt={change.account.displayName}
              onError={handleImageError}
              className="w-10 h-10 rounded-full object-cover border bg-muted"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border bg-muted flex items-center justify-center font-bold text-xs uppercase">
              {change.account.username.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="font-semibold flex items-center space-x-2">
              <span>{change.account.displayName || change.account.username}</span>
              <span className="text-xs font-normal text-muted-foreground">({change.account.platform})</span>
            </div>
            <div className="text-xs text-muted-foreground">@{change.account.username}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/50 p-3 rounded-md">
          <div>
            <span className="text-xs text-muted-foreground block uppercase font-medium">{t("fromLabel")}</span>
            <span className="font-medium text-foreground">{prevLocText}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block uppercase font-medium">{t("toLabel")}</span>
            <span className="font-medium text-foreground">{newLocText}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span>{t("reportedAtLabel")}: {new Date(change.createdAt).toLocaleDateString()}</span>
          <span>•</span>
          <StatusBadge variant="pendingReview" label={tStatus("PENDING_REVIEW")} />
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
        <button
          onClick={() => onResolve(change.id, "ACCEPT")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 h-9 px-4 py-2"
        >
          {t("buttonAccept")}
        </button>
        <button
          onClick={() => onResolve(change.id, "REVERT")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          {t("buttonRevert")}
        </button>
      </div>
    </div>
  )
}
