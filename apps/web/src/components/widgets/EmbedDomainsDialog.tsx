"use client"

import React, { useState } from "react"
import { useEmbedDomainsForWidgetQuery, useRegisterEmbedDomainMutation, useDeregisterEmbedDomainMutation } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface EmbedDomainsDialogProps {
  widgetId: string | null
  isOpen: boolean
  onClose: () => void
}

export function EmbedDomainsDialog({ widgetId, isOpen, onClose }: EmbedDomainsDialogProps) {
  const queryClient = useQueryClient()
  const [newPattern, setNewPattern] = useState("")

  const { data, isLoading, refetch } = useEmbedDomainsForWidgetQuery(
    graphqlClient,
    { widgetId: widgetId || "" },
    { enabled: !!widgetId && isOpen }
  )

  const { mutateAsync: registerDomain, isPending: isRegistering } = useRegisterEmbedDomainMutation(graphqlClient)
  const { mutateAsync: deregisterDomain, isPending: isDeregistering } = useDeregisterEmbedDomainMutation(graphqlClient)

  const validatePattern = (pattern: string): boolean => {
    const clean = pattern.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0]
    
    // Check wildcard format
    if (clean.startsWith("*.")) {
      const suffix = clean.slice(2)
      return suffix.length > 0 && !suffix.includes("*")
    }
    
    // Exact match hostname (no wildcards allowed in exact patterns)
    return clean.length > 0 && !clean.includes("*")
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!widgetId) return

    if (!validatePattern(newPattern)) {
      toast.error("Invalid pattern format. Must be like 'acmecorp.com' or '*.acmecorp.com'")
      return
    }

    try {
      await registerDomain({
        widgetId,
        pattern: newPattern,
      })
      toast.success("Embed domain registered successfully!")
      setNewPattern("")
      queryClient.invalidateQueries({ queryKey: ["embedDomainsForWidget"] })
      refetch()
    } catch (err: any) {
      toast.error(err.message || "Failed to register embed domain")
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await deregisterDomain({
        id,
        action: "DELETE" as any,
      })
      
      toast.success("Domain deregistered successfully", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deregisterDomain({
                id,
                action: "RESTORE" as any,
              })
              toast.success("Domain restored successfully!")
              queryClient.invalidateQueries({ queryKey: ["embedDomainsForWidget"] })
              refetch()
            } catch {
              toast.error("Failed to restore domain")
            }
          },
        },
      })

      queryClient.invalidateQueries({ queryKey: ["embedDomainsForWidget"] })
      refetch()
    } catch {
      toast.error("Failed to deregister domain")
    }
  }

  const activeDomains = data?.embedDomainsForWidget || []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Manage Embed Domains</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-4 my-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Register Allowed Domain or Wildcard
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. acmecorp.com or *.acmecorp.com"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
                disabled={isRegistering}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 disabled:opacity-50"
                disabled={isRegistering || !newPattern.trim()}
              >
                Add
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Supports exact hostnames or wildcards format <span className="font-mono">*.domain.com</span>. Public suffixes (e.g. vercel.app) are rejected.
            </p>
          </div>
        </form>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Registered Whitelist</h4>
          {isLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse text-center py-4">
              Loading Whitelist...
            </div>
          ) : activeDomains.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4 border rounded border-dashed">
              No domains registered yet. This widget is currently restricted from rendering anywhere.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
              {activeDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-2.5 rounded bg-muted text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <span className="font-mono">{domain.pattern}</span>
                  <button
                    onClick={() => handleRemove(domain.id)}
                    disabled={isDeregistering}
                    className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
