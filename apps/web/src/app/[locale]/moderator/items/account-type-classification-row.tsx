"use client"

import React from "react"
import { StatusBadge } from "@festgrid/ui"
import { useTranslations, useLocale } from "next-intl"

export interface AccountTypeClassificationReview {
  id: string
  accountId: string
  proposedAccountType?: string | null
  confidenceScore?: number | null
  failureReason?: string | null
  createdAt: string
  account: {
    id: string
    displayName: string
    platform: string
    username: string
    profileImageUrl?: string | null
    description?: string | null
  }
}

interface AccountTypeClassificationRowProps {
  review: AccountTypeClassificationReview
  onResolve: (id: string, accountType: "ORGANIZER_VENUE_EVENT" | "PERSONAL" | "CURATOR_GUIDE") => Promise<void>
}

export function AccountTypeClassificationRow({ review, onResolve }: AccountTypeClassificationRowProps) {
  const t = useTranslations("ModeratorItemsPage")
  const tAccountType = useTranslations("AccountType")
  const locale = useLocale()

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = "none"
  }

  const hasProposedType = review.proposedAccountType != null

  const formattedConfidence =
    review.confidenceScore != null
      ? new Intl.NumberFormat(locale, { style: "percent" }).format(review.confidenceScore)
      : null

  return (
    <div className="p-4 sm:p-6 border rounded-lg bg-card shadow-sm space-y-4 flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-6">
      <div className="space-y-3 flex-1">
        <div className="flex items-center space-x-3">
          {review.account.profileImageUrl ? (
            <img
              src={review.account.profileImageUrl}
              alt={review.account.displayName}
              onError={handleImageError}
              className="w-10 h-10 rounded-full object-cover border bg-muted"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border bg-muted flex items-center justify-center font-bold text-xs uppercase">
              {review.account.username.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="font-semibold flex items-center space-x-2">
              <span>{review.account.displayName || review.account.username}</span>
              <span className="text-xs font-normal text-muted-foreground">({review.account.platform})</span>
            </div>
            <div className="text-xs text-muted-foreground">@{review.account.username}</div>
          </div>
        </div>

        <div className="text-sm bg-muted/50 p-3 rounded-md space-y-2">
          <div>
            <span className="text-xs text-muted-foreground block uppercase font-medium">{t("bioLabel")}</span>
            <span className="text-foreground line-clamp-2">{review.account.description || "—"}</span>
          </div>

          {hasProposedType ? (
            <div className="flex items-center space-x-2">
              <div>
                <span className="text-xs text-muted-foreground block uppercase font-medium">{t("proposedTypeLabel")}</span>
                <span className="font-medium text-foreground">{tAccountType(review.proposedAccountType as any)}</span>
              </div>
              {formattedConfidence && (
                <div>
                  <span className="text-xs text-muted-foreground block uppercase font-medium">{t("confidenceLabel")}</span>
                  <StatusBadge variant="lowConfidence" label={formattedConfidence} />
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="text-xs text-muted-foreground block uppercase font-medium">{t("failureReasonLabel")}</span>
              <div className="flex items-center space-x-2">
                <StatusBadge variant="classificationFailed" label={t("classificationFailedLabel")} />
                <span className="text-foreground">{review.failureReason}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
        <button
          onClick={() => onResolve(review.id, "ORGANIZER_VENUE_EVENT")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 h-9 px-4 py-2"
        >
          {t("buttonResolveOrganizerVenueEvent")}
        </button>
        <button
          onClick={() => onResolve(review.id, "PERSONAL")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          {t("buttonResolvePersonal")}
        </button>
        <button
          onClick={() => onResolve(review.id, "CURATOR_GUIDE")}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          {t("buttonResolveCuratorGuide")}
        </button>
      </div>
    </div>
  )
}
