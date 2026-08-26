"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useSoftDeleteWithUndo, PageContainer, PageHeader, StatusBadge } from "@festgrid/ui"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { useRouter, Link } from "@/i18n/navigation"
import { graphqlClient } from "@/lib/graphql-client"
import { useGetMyApiKeysQuery, useDeleteApiKeyMutation, SoftDeleteAction } from "@/generated/graphql"
import { ApiKeyFormDialog } from "./api-key-form-dialog"
import { Plus, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ApiKeysContent() {
  const t = useTranslations("ApiKeysSettingsPage")
  const tQueue = useTranslations("QueueStatusPage")
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session, isLoading: authLoading } = useAuthSession()

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login")
    }
  }, [authLoading, session, router])

  // Query api keys
  const { data, isLoading, error, refetch } = useGetMyApiKeysQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  )

  const { mutateAsync: deleteApiKey } = useDeleteApiKeyMutation(graphqlClient)

  const { isPending, markPending } = useSoftDeleteWithUndo<string>({
    onExpire: (id) => {
      // Splice from React Query cache immediately without refetch (AC8)
      queryClient.setQueriesData({ queryKey: ["GetMyApiKeys"] }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          myApiKeys: (old.myApiKeys || []).filter((key: any) => key.id !== id),
        }
      })
    },
  })

  const apiKeysList = data?.myApiKeys || []
  const hasInvalidKey = apiKeysList.some((key: any) => !key.isValid)

  const handleDelete = async (key: any) => {
    try {
      // Call deleteApiKey(DELETE) immediately (AC8)
      await deleteApiKey({
        id: key.id,
        action: SoftDeleteAction.Delete,
      })

      // Fire analytics event on immediate commit (AC11)
      const posthog = (window as any).posthog
      if (posthog) {
        posthog.capture("api_key_revoked", {
          provider: key.provider,
        })
      }

      // Then enter pending state with RESTORE callback
      markPending(
        key.id,
        async () => {
          try {
            await deleteApiKey({
              id: key.id,
              action: SoftDeleteAction.Restore,
            })
          } catch (err) {
            console.error("Failed to restore api key", err)
            throw err
          }
        },
        {
          message: t("revokedToast"),
          undoLabel: t("undoLabel"),
        }
      )
    } catch (err) {
      console.error("Failed to delete api key", err)
      const { toast } = await import("sonner")
      toast.error(t("addErrorToast") || "Failed to revoke api key")
    }
  }

  if (authLoading || isLoading) {
    return (
      <PageContainer fullWidth={false}>
        <div className="h-10 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          <div className="h-12 w-full bg-muted rounded animate-pulse" />
          <div className="h-12 w-full bg-muted rounded animate-pulse" />
          <div className="h-12 w-full bg-muted rounded animate-pulse" />
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer fullWidth={false} className="text-center space-y-4">
        <p className="text-destructive font-medium">{t("errorState")}</p>
        <Button onClick={() => refetch()} variant="outline">
          {t("retryButtonLabel")}
        </Button>
      </PageContainer>
    )
  }

  return (
    <PageContainer fullWidth={false}>
      <PageHeader title={t("title")} action={{ label: t("addButtonLabel"), icon: <Plus className="h-4 w-4" />, onClick: () => setIsDialogOpen(true) }} />

      {hasInvalidKey && (
        <div className="p-4 mb-6 border rounded-md bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200 text-sm">
          {tQueue("invalidKeyWarningPrompt")}{" "}
          <Link
            href="/settings/account?tab=api-keys"
            className="underline font-semibold text-yellow-900 dark:text-yellow-100 hover:text-yellow-950"
          >
            {tQueue("invalidKeyWarningLinkLabel")}
          </Link>
        </div>
      )}

      {apiKeysList.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("providerColumnLabel")}</TableHead>
                <TableHead>{t("keyColumnLabel")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">{t("actionsColumnLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeysList.map((key: any) => {
                const pending = isPending(key.id)
                return (
                  <TableRow key={key.id} className={pending ? "opacity-50" : ""}>
                    <TableCell className="font-medium capitalize">{key.provider}</TableCell>
                    <TableCell className="font-mono">{key.maskedKey}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={key.isValid ? "active" : "invalid"}
                        label={
                          key.isValid
                            ? tQueue("activeStatusLabel") || "Active"
                            : tQueue("invalidStatusLabel") || "Invalid"
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(key)}
                        disabled={pending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">{t("revokeButtonLabel")}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ApiKeyFormDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </PageContainer>
  )
}
