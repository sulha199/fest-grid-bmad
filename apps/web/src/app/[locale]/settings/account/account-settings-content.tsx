"use client"

import { useQueryState, parseAsStringEnum } from "nuqs"
import { useTranslations } from "next-intl"
import { TabbedShell } from "@festgrid/ui"
import { ApiKeysContent } from "./api-keys-content"
import { SubscriptionsContent } from "./subscriptions-content"
import { NotificationsContent } from "./notifications-content"
import { PostsSelectContent } from "@/app/[locale]/posts/select/posts-select-content"

const tabEnum = parseAsStringEnum(['api-keys', 'subscriptions', 'posts', 'notifications']).withDefault('api-keys')

export function AccountSettingsContent() {
  const t = useTranslations("AccountSettings")
  const [tab, setTab] = useQueryState("tab", tabEnum)

  const tabs = [
    {
      key: "api-keys",
      label: t("apiKeysTabLabel"),
      Component: ApiKeysContent,
    },
    {
      key: "subscriptions",
      label: t("subscribedAccountsTabLabel"),
      Component: SubscriptionsContent,
    },
    {
      key: "posts",
      label: t("postsTabLabel"),
      Component: PostsSelectContent,
      keepMounted: true,
    },
    {
      key: "notifications",
      label: t("notificationsTabLabel"),
      Component: NotificationsContent,
      keepMounted: true,
    },
  ]

  return (
    <div className="py-6">
      <TabbedShell
        tabs={tabs}
        activeKey={tab}
        onTabChange={(key) => { void setTab(key as typeof tab); }}
      />
    </div>
  )
}
