"use client"

import { useQueryState, parseAsStringEnum } from "nuqs"
import { useTranslations } from "next-intl"
import { TabbedShell } from "@festgrid/ui"
import { ActorRunsContent } from "./actor-runs-content"
import { UnprocessedPayloadsContent } from "./unprocessed-payloads-content"
import { ModeratorAccountsContent } from "./moderator-accounts-content"

const tabEnum = parseAsStringEnum(['actor-runs', 'unprocessed-payloads', 'accounts']).withDefault('actor-runs')

export function ModeratorToolsContent() {
  const t = useTranslations("ModeratorToolsPage")
  const [tab, setTab] = useQueryState("tab", tabEnum)

  const tabs = [
    {
      key: "actor-runs",
      label: t("actorRunsTabLabel"),
      Component: ActorRunsContent,
    },
    {
      key: "unprocessed-payloads",
      label: t("unprocessedPayloadsTabLabel"),
      Component: UnprocessedPayloadsContent,
    },
    {
      key: "accounts",
      label: t("accountsTabLabel"),
      Component: ModeratorAccountsContent,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("pageHeading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </div>
      <TabbedShell
        tabs={tabs}
        activeKey={tab}
        onTabChange={(key) => { void setTab(key as typeof tab); }}
      />
    </div>
  )
}
