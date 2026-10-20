"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { RouteLoader } from "@festgrid/ui"
import { Button } from "@/components/ui/button"
import { useRequireModerator } from "@/features/auth/use-require-moderator"
import { usePostReextractionPreview } from "@/features/moderation/use-post-reextraction-preview"
import { ReextractPreviewResult } from "@/features/moderation/reextract-preview-result"

/**
 * AD-40 -- Moderator -> Tools -> Re-extract. Takes a post URL, for posts that have no event (so
 * there is no event page to launch from). A post already in the database is previewed from its
 * stored caption; an unknown URL is scraped. Preview only.
 */
export function ReextractContent() {
  const t = useTranslations("ReextractPreview")
  const { status: authStatus } = useRequireModerator()
  const [url, setUrl] = useState("")
  const { start, phase, preview, errorMessage } = usePostReextractionPreview()

  if (authStatus === "loading" || authStatus === "unauthenticated" || authStatus === "unauthorized") return <RouteLoader />

  const trimmed = url.trim()
  const isBusy = phase === "starting" || phase === "running"

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("tabDescription")}</p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed && !isBusy) void start({ url: trimmed })
        }}
      >
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("urlPlaceholder")}
          aria-label={t("urlLabel")}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={!trimmed || isBusy}>
          {t("previewButton")}
        </Button>
      </form>

      {isBusy && (
        <div role="status">
          <p className="py-4 text-center text-sm text-muted-foreground">{t("running")}</p>
        </div>
      )}
      {phase === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage || t("genericError")}
        </p>
      )}
      {phase === "done" && preview && <ReextractPreviewResult preview={preview} />}
    </div>
  )
}
