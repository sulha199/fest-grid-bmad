"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { SwipeToReveal, useSoftDeleteWithUndo } from "@festgrid/ui"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { useRouter } from "@/i18n/navigation"
import { graphqlClient } from "@/lib/graphql-client"
import { useGetMyLocationsQuery, useDeleteUserLocationMutation, SoftDeleteAction } from "@/generated/graphql"
import { LocationFormDialog, UserLocation } from "./location-form-dialog"
import { Plus, Edit2, Trash2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

export function LocationsContent() {
  const t = useTranslations("SavedLocationsPage")
  const router = useRouter()
  const queryClient = useQueryClient()
  const { session, isLoading: authLoading } = useAuthSession()

  const [isDialogOpen, setIsDropdownOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<UserLocation | undefined>(undefined)

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login")
    }
  }, [authLoading, session, router])

  // Query saved locations
  const { data, isLoading, error, refetch } = useGetMyLocationsQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  )

  const { mutateAsync: deleteUserLocation } = useDeleteUserLocationMutation(graphqlClient)
  const { isPending, markPending } = useSoftDeleteWithUndo<string>({
    onExpire: (id) => {
      // Splice from React Query cache immediately without refetch (AC11)
      queryClient.setQueryData(["getMyLocations"], (old: any) => {
        if (!old) return old
        return {
          ...old,
          myLocations: (old.myLocations || []).filter((loc: any) => loc.id !== id),
        }
      })
    },
  })

  const locations = (data?.myLocations || []) as UserLocation[]

  const handleOpenAddDialog = () => {
    setEditingLocation(undefined)
    setIsDropdownOpen(true)
  }

  const handleOpenEditDialog = (location: UserLocation) => {
    setEditingLocation(location)
    setIsDropdownOpen(true)
  }

  const handleDelete = async (location: UserLocation) => {
    try {
      // Call deleteUserLocation(DELETE) immediately (AC9)
      await deleteUserLocation({
        id: location.id,
        action: SoftDeleteAction.Delete,
      })

      // Fire analytics event saved_location_deleted on immediate commit (AC9 / Task 6 revised)
      const posthog = (window as any).posthog
      if (posthog) {
        posthog.capture("saved_location_deleted", {
          locationId: location.id,
        })
      }

      // Then enter pending state with RESTORE callback (AC9, AC10)
      markPending(
        location.id,
        async () => {
          try {
            await deleteUserLocation({
              id: location.id,
              action: SoftDeleteAction.Restore,
            })
          } catch (err) {
            console.error("Failed to restore location", err)
            throw err
          }
        },
        {
          message: t("deleteButtonLabel") === "Hapus" ? "Lokasi dihapus" : "Location removed",
          undoLabel: t("cancelButtonLabel") === "Batal" ? "Urungkan" : "Undo",
        }
      )
    } catch (err) {
      console.error("Failed to delete location", err)
      // AC11a: Failed DELETE call reverts optimistic grey-out and shows error toast
      const { toast } = await import("sonner")
      toast.error(t("locationSaveErrorAnnouncement") || "Failed to delete location")
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">
        <div className="h-10 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          <div className="h-20 w-full bg-muted rounded animate-pulse" />
          <div className="h-20 w-full bg-muted rounded animate-pulse" />
          <div className="h-20 w-full bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto text-center space-y-4">
        <p className="text-destructive font-medium">{t("errorState")}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        {locations.length > 0 && (
          <button
            onClick={handleOpenAddDialog}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("addButtonLabel")}</span>
          </button>
        )}
      </div>

      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center space-y-4">
          <p className="text-muted-foreground">{t("emptyState")}</p>
          <button
            onClick={handleOpenAddDialog}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            {t("addButtonLabel")}
          </button>
        </div>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden bg-card">
          {locations.map((loc) => {
            const pending = isPending(loc.id)

            return (
              <SwipeToReveal
                key={loc.id}
                disabled={pending}
                action={
                  <div className="bg-destructive text-destructive-foreground h-full px-6 flex items-center gap-2 font-medium">
                    <Trash2 className="h-4 w-4" />
                    <span>{t("deleteButtonLabel")}</span>
                  </div>
                }
                onAction={() => handleDelete(loc)}
              >
                <div
                  className={`flex items-center justify-between p-4 bg-background transition-opacity ${
                    pending ? "opacity-40 pointer-events-none" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{loc.name}</h3>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {t("radiusUnit", { count: Math.round(loc.radius / 1000) })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {loc.locationDetails.formattedAddress}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditDialog(loc)}
                      disabled={pending}
                      className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                      aria-label="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {/* Desktop non-touch fallback trash button */}
                    <button
                      onClick={() => handleDelete(loc)}
                      disabled={pending}
                      className="p-2 hover:bg-accent text-destructive hover:text-destructive-foreground rounded-md transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </SwipeToReveal>
            )
          })}
        </div>
      )}

      <LocationFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDropdownOpen(false)}
        location={editingLocation}
      />
    </div>
  )
}
