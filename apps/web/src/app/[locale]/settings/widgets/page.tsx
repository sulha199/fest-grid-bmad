"use client"

import React, { useState } from "react"
import { useMyWidgetsQuery, useCreateWidgetMutation, useUpdateWidgetMutation, useDeleteWidgetMutation, WidgetDisplayMode, WidgetTheme } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BlockingLoader } from "@festgrid/ui"

export default function WidgetsPage() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<any>(null)

  const [theme, setTheme] = useState<WidgetTheme>(WidgetTheme.Light)
  const [displayMode, setDisplayMode] = useState<WidgetDisplayMode>(WidgetDisplayMode.Card)
  const [filtersText, setFiltersText] = useState("{}")

  const { data, isLoading, refetch } = useMyWidgetsQuery(graphqlClient)

  const { mutateAsync: createWidget, isPending: isCreating } = useCreateWidgetMutation(graphqlClient)
  const { mutateAsync: updateWidget, isPending: isUpdating } = useUpdateWidgetMutation(graphqlClient)
  const { mutateAsync: deleteWidget, isPending: isDeleting } = useDeleteWidgetMutation(graphqlClient)

  const handleOpenCreate = () => {
    setEditingWidget(null)
    setTheme(WidgetTheme.Light)
    setDisplayMode(WidgetDisplayMode.Card)
    setFiltersText("{}")
    setIsOpen(true)
  }

  const handleOpenEdit = (widget: any) => {
    setEditingWidget(widget)
    setTheme(widget.theme)
    setDisplayMode(widget.displayMode)
    setFiltersText(JSON.stringify(widget.filters, null, 2))
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let parsedFilters;
    try {
      parsedFilters = JSON.parse(filtersText)
    } catch {
      toast.error("Invalid filters JSON formatting")
      return
    }

    try {
      if (editingWidget) {
        await updateWidget({
          id: editingWidget.id,
          input: {
            filters: parsedFilters,
            displayMode,
            theme,
          }
        })
        toast.success("Widget updated successfully!")
      } else {
        await createWidget({
          input: {
            filters: parsedFilters,
            displayMode,
            theme,
          }
        })
        toast.success("Widget created successfully!")
      }
      queryClient.invalidateQueries({ queryKey: ["myWidgets"] })
      refetch()
      setIsOpen(false)
    } catch {
      toast.error("Failed to save widget")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this widget?")) return
    try {
      await deleteWidget({
        id,
        action: "DELETE" as any
      })
      toast.success("Widget deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["myWidgets"] })
      refetch()
    } catch {
      toast.error("Failed to delete widget")
    }
  }

  const widgetsList = data?.myWidgets || []
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <BlockingLoader active={isCreating || isUpdating || isDeleting} label="Saving..." />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Embeddable Widgets</h1>
          <p className="text-muted-foreground mt-1">
            Configure, manage and generate responsive discovery widgets for your site!
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Create Widget
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(n => (
            <div key={n} className="h-32 bg-card border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : widgetsList.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">
          You haven't generated any widgets yet. Click "Create Widget" to get started!
        </div>
      ) : (
        <div className="space-y-6">
          {widgetsList.map((widget) => {
            const scriptSnippet = `<div data-festdaily-widget-id="${widget.id}"></div>\n<script async src="${origin}/embed.js"></script>`
            const iframeUrl = `${origin}/widget/${widget.id}`

            return (
              <div key={widget.id} className="p-6 border rounded-lg bg-card space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Widget: {widget.id.slice(0, 8)}</h3>
                    <p className="text-xs text-muted-foreground">
                      Mode: <span className="font-semibold text-foreground">{widget.displayMode}</span> • Theme: <span className="font-semibold text-foreground">{widget.theme}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(widget)}
                      className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                    >
                      Edit Config
                    </button>
                    <button
                      onClick={() => handleDelete(widget.id)}
                      className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-destructive text-destructive bg-background hover:bg-destructive/10 h-8 px-3"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Recommended Snippet (Script)</label>
                    <textarea
                      readOnly
                      value={scriptSnippet}
                      onClick={(e) => {
                        (e.target as HTMLTextAreaElement).select()
                        navigator.clipboard.writeText(scriptSnippet)
                        toast.success("Copied to clipboard!")
                      }}
                      className="w-full h-16 text-xs p-2 bg-muted font-mono rounded border cursor-pointer focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Raw Iframe Fallback URL</label>
                    <input
                      type="text"
                      readOnly
                      value={iframeUrl}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).select()
                        navigator.clipboard.writeText(iframeUrl)
                        toast.success("Copied to clipboard!")
                      }}
                      className="w-full h-10 text-xs px-2 bg-muted font-mono rounded border cursor-pointer focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="sm:max-w-lg bg-background">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingWidget ? "Edit Widget Settings" : "Configure New Widget"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Display Mode</label>
                <Select value={displayMode} onValueChange={(val: any) => setDisplayMode(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border">
                    <SelectItem value={WidgetDisplayMode.Card}>Card View</SelectItem>
                    <SelectItem value={WidgetDisplayMode.Calendar}>Calendar View</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Theme</label>
                <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border">
                    <SelectItem value={WidgetTheme.Light}>Light</SelectItem>
                    <SelectItem value={WidgetTheme.Dark}>Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground block">DSL Filters JSON</label>
              <textarea
                value={filtersText}
                onChange={(e) => setFiltersText(e.target.value)}
                placeholder='e.g. { "types": ["FESTIVAL"] }'
                className="w-full h-32 text-xs p-3 font-mono rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-6">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Save Configuration
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
