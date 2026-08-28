"use client"

import React from "react"
import { usePathname, useRouter } from "@/i18n/navigation"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export default function ModalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // We only render the Dialog wrapper if the current pathname is an event detail path
  const isEventDetail = pathname.includes("/events/")

  if (!isEventDetail) {
    return <>{children}</>
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) router.back() }}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-6 rounded-xl"
        showCloseButton={false}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
