"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { RouteLoader } from "@festgrid/ui"
import { Button } from "@/components/ui/button"
import { useRequireModerator } from "@/features/auth/use-require-moderator"
import { ReextractJobHost } from "@/features/moderation/reextract-job-host"

/**
 * AD-40 -- Moderator -> Tools -> Re-extract. Takes a post URL, for posts that have no event (so
 * there is no event page to launch from). A post already in the database is previewed from its
 * stored caption; an unknown URL is scraped. Preview only.
 *
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): the same shared host as the source-post rows. Preview starts the job
 * and attaches to it from the start result (the field is empty after a reload, so there is nothing to find an old job by: it is reached from the Jobs
 * page). The dialog can be minimized to a chip beside the form and re-opened, and closing it never drops the job.
 */
export function ReextractContent() {
  const t = useTranslations("ReextractPreview")
  const { status: authStatus } = useRequireModerator()
  const [url, setUrl] = useState("")

  if (authStatus === "loading" || authStatus === "unauthenticated" || authStatus === "unauthorized") return <RouteLoader />

  const trimmed = url.trim()

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("tabDescription")}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ReextractJobHost className="min-w-0 max-w-full">
          {({ start, starting, triggerRef }) => (
            <form
              className="flex w-full flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                if (trimmed && !starting) void start({ url: trimmed })
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
              <Button ref={triggerRef} type="submit" disabled={!trimmed || starting} aria-busy={starting || undefined}>
                {t("previewButton")}
              </Button>
            </form>
          )}
        </ReextractJobHost>
      </div>
    </div>
  )
}
