"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { BlockingLoader } from "@festgrid/ui"
import { graphqlClient } from "@/lib/graphql-client"
import { useCreateApiKeyMutation } from "@/generated/graphql"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ApiKeyFormDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ApiKeyFormDialog({ isOpen, onClose }: ApiKeyFormDialogProps) {
  const t = useTranslations("ApiKeysSettingsPage")
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [provider, setProvider] = useState("gemini")
  const [key, setKey] = useState("")

  const { mutateAsync: createApiKey } = useCreateApiKeyMutation(graphqlClient)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key) return

    setIsSubmitting(true)
    try {
      const result = await createApiKey({
        input: {
          provider,
          key,
        },
      })

      // Fire analytics event
      const posthog = (window as any).posthog
      if (posthog) {
        posthog.capture("api_key_added", {
          provider,
        })
      }

      // Prepend to React Query cache (AC4)
      queryClient.setQueriesData({ queryKey: ["GetMyApiKeys"] }, (old: any) => {
        if (!old) return { myApiKeys: [result.createApiKey] }
        return {
          ...old,
          myApiKeys: [result.createApiKey, ...(old.myApiKeys || [])],
        }
      })

      const { toast } = await import("sonner")
      toast.success(t("addSuccessToast"))
      setKey("")
      onClose()
    } catch (err) {
      console.error(err)
      const { toast } = await import("sonner")
      toast.error(t("addErrorToast"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {isSubmitting && <BlockingLoader />}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addModalTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("providerLabel")}</label>
              <Select
                value={provider}
                onValueChange={(val) => setProvider(val)}
                disabled
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Gemini" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="apiKeyInput">
                {t("keyLabel")}
              </label>
              <input
                id="apiKeyInput"
                type="password"
                placeholder={t("keyPlaceholder")}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {t("howToGetKeyLinkLabel")}
              </a>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {t("submitButtonLabel")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
