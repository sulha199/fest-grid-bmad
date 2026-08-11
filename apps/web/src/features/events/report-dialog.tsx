"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BlockingLoader } from "@festgrid/ui";
import { graphqlClient } from "@/lib/graphql-client";
import { useSubmitReportMutation, ReportReason } from "@/generated/graphql";
import { toast } from "sonner";
import { usePostHog } from "@festgrid/analytics";
import { ClientError } from "graphql-request";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onReported: () => void;
}

export function ReportDialog({ isOpen, onClose, eventId, onReported }: ReportDialogProps) {
  const t = useTranslations("EventReportForm");
  const posthog = usePostHog();

  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  const { mutateAsync: submitReport, isPending } = useSubmitReportMutation(graphqlClient);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedReason(null);
      setDetails("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason || isPending) return;

    try {
      const response = await submitReport({
        eventId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      const reportId = response.submitReport.id;
      
      // Capture PostHog event
      posthog.capture("event_reported", {
        eventId,
        reportId,
        reason: selectedReason.toLowerCase(),
      });

      toast.success(t("successToast") || "Report submitted successfully");
      onClose();
      onReported();
    } catch (err) {
      if (err instanceof ClientError) {
        const firstError = err.response?.errors?.[0];
        if (firstError?.extensions?.code === "REPORT_IGNORED") {
          toast.error(t("reportIgnoredError") || "This report has already been reviewed.");
          onClose();
          onReported();
          return;
        }
      }
      toast.error(t("errorToast") || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && !isPending && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle") || "Report Event"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t("reasonLabel") || "Reason for reporting"}
              </label>
              
              <RadioGroup
                value={selectedReason || ""}
                onValueChange={(val) => setSelectedReason(val as ReportReason)}
                disabled={isPending}
                className="space-y-3"
              >
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                  <RadioGroupItem value={ReportReason.Cancelled} id="reason-cancelled" className="mt-1" />
                  <label htmlFor="reason-cancelled" className="flex flex-col gap-0.5 cursor-pointer flex-1 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {t("reasonCancelledLabel") || "Event Cancelled"}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("reasonCancelledDescription") || "This event is cancelled, has wrong date, or does not exist."}
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                  <RadioGroupItem value={ReportReason.Dangerous} id="reason-dangerous" className="mt-1" />
                  <label htmlFor="reason-dangerous" className="flex flex-col gap-0.5 cursor-pointer flex-1 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {t("reasonDangerousLabel") || "Dangerous or Illegal Event"}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("reasonDangerousDescription") || "Extreme situation, hazardous, or unlawful activities."}
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                  <RadioGroupItem value={ReportReason.Personal} id="reason-personal" className="mt-1" />
                  <label htmlFor="reason-personal" className="flex flex-col gap-0.5 cursor-pointer flex-1 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {t("reasonPersonalLabel") || "Personal"}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("reasonPersonalDescription") || "Hide this event for me without affecting other users."}
                    </span>
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <label htmlFor="details" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t("detailsLabel") || "Additional details (optional)"}
              </label>
              <Textarea
                id="details"
                disabled={isPending}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("detailsPlaceholder") || "Provide details..."}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={onClose}
              >
                {t("cancelButtonLabel") || "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={!selectedReason || isPending}
              >
                {t("submitButtonLabel") || "Submit Report"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <BlockingLoader active={isPending} label={t("submittingAnnouncement") || "Submitting report..."} />
    </>
  );
}
