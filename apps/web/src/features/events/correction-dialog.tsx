"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BlockingLoader, CorrectionForm, type CorrectionFormLabels, type ValidationErrorItem } from "@festgrid/ui";
import { graphqlClient } from "@/lib/graphql-client";
import { useSubmitCorrectionMutation, EventCategory, EventType, CorrectionSource } from "@/generated/graphql";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePostHog } from "@festgrid/analytics";
import { validateProposedEventCorrection } from "@/lib/validation/proposed-event-correction.schema";
import Link from "next/link";
import { AiAssistedCorrectionTrigger } from "./ai-assisted-correction-trigger";

interface CorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    eventName: string;
    description?: string | null;
    location?: string | null;
    imageUrl?: string | null;
    sourcePostUrl?: string | null;
    originalPostUrl?: string | null;
    organizerName?: string | null;
    contactInfo?: string | null;
    types?: EventType[] | null;
    categories?: EventCategory[] | null;
    sourceSocialMediaAccountProfile?: {
      accountType?: string | null;
    } | null;
    schedules: Array<{
      id: string;
      isMainSchedule: boolean;
      eventStartDate: string;
      eventEndDate?: string | null;
      eventStartTime?: string | null;
      eventEndTime?: string | null;
      title?: string | null;
      performers?: string[] | null;
      location?: string | null;
      ticketPrice?: string | null;
    }>;
  };
}

export function CorrectionDialog({ isOpen, onClose, event }: CorrectionDialogProps) {
  const t = useTranslations("EventCorrectionForm");
  const tAi = useTranslations("AiAssistedCorrection");
  const tType = useTranslations("EventType");
  const tCategory = useTranslations("EventCategory");
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);

  const { mutateAsync: submitCorrection, isPending } = useSubmitCorrectionMutation(graphqlClient);

  // Map option list
  const typeOptions = Object.values(EventType).map((val) => ({
    value: val,
    label: tType(val) || val,
  }));

  const categoryOptions = Object.values(EventCategory).map((val) => ({
    value: val,
    label: tCategory(val) || val,
  }));

  // Build initial values from event
  const mainSchedule = event.schedules.find((s) => s.isMainSchedule);
  const eventInitialValues = {
    eventName: event.eventName,
    types: (event.types || []) as any,
    categories: (event.categories || []) as any,
    location: event.location || "",
    organizerName: event.organizerName || "",
    contactInfo: event.contactInfo || "",
    description: event.description || "",
    schedules: mainSchedule
      ? [
          {
            id: mainSchedule.id,
            isMainSchedule: true,
            eventStartDate: mainSchedule.eventStartDate,
            eventEndDate: mainSchedule.eventEndDate || undefined,
            eventStartTime: mainSchedule.eventStartTime || undefined,
            eventEndTime: mainSchedule.eventEndTime || undefined,
            title: mainSchedule.title || undefined,
            performers: mainSchedule.performers || undefined,
            location: mainSchedule.location || undefined,
            ticketPrice: mainSchedule.ticketPrice || undefined,
          },
        ]
      : [],
  };

  const [formKey, setFormKey] = useState(0);
  const [formValues, setFormValues] = useState(eventInitialValues);
  const [hasExtracted, setHasExtracted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormValues(eventInitialValues);
      setHasExtracted(false);
      setFormKey((k) => k + 1);
    }
  }, [isOpen, event]);

  const handleExtracted = (data: any) => {
    setFormValues((prev) => ({
      ...data,
      schedules: [
        {
          ...data.schedules[0],
          id: prev.schedules[0]?.id,
        },
      ],
    }));
    setHasExtracted(true);
    setFormKey((k) => k + 1);
    posthog.capture("event_correction_ai_extraction_succeeded", { eventId: event.id });
  };

  const aiAssistedLabels = {
    triggerButtonLabel: tAi("triggerButtonLabel") || "AI-Assisted Correction",
    urlInputLabel: tAi("urlInputLabel") || "Social media post URL",
    urlInputPlaceholder: tAi("urlInputPlaceholder") || "Paste link here...",
    extractButtonLabel: tAi("extractButtonLabel") || "Extract",
    extractingAnnouncement: tAi("extractingAnnouncement") || "Extracting...",
    errorNotFound: tAi("errorNotFound") || "Not found",
    errorUnsupportedPlatform: tAi("errorUnsupportedPlatform") || "Unsupported platform",
    errorNoApiKey: tAi.rich("errorNoApiKey", {
      link: (chunks) => <Link href="/settings/api-keys" className="underline font-semibold">{chunks}</Link>
    }) || "No API key",
    errorScrapeFailed: tAi("errorScrapeFailed") || "Scrape failed",
    errorExtractionFailed: tAi("errorExtractionFailed") || "Extraction failed",
    errorQuotaExhausted: tAi("errorQuotaExhausted") || "Quota exhausted",
  };

  const labels: CorrectionFormLabels = {
    eventNameLabel: t("eventNameLabel") || "Event Name",
    typesLabel: t("typesLabel") || "Types",
    categoriesLabel: t("categoriesLabel") || "Categories",
    locationLabel: t("locationLabel") || "Location",
    organizerNameLabel: t("organizerNameLabel") || "Organizer Name",
    contactInfoLabel: t("contactInfoLabel") || "Contact Info",
    descriptionLabel: t("descriptionLabel") || "Description",
    scheduleStartDateLabel: t("scheduleStartDateLabel") || "Start Date",
    scheduleEndDateLabel: t("scheduleEndDateLabel") || "End Date",
    scheduleStartTimeLabel: t("scheduleStartTimeLabel") || "Start Time",
    scheduleEndTimeLabel: t("scheduleEndTimeLabel") || "End Time",
    scheduleTitleLabel: t("scheduleTitleLabel") || "Schedule Title",
    schedulePerformersLabel: t("schedulePerformersLabel") || "Performers",
    scheduleLocationLabel: t("scheduleLocationLabel") || "Schedule Location",
    scheduleTicketPriceLabel: t("scheduleTicketPriceLabel") || "Ticket Price",
    submitButtonLabel: t("submitButtonLabel") || "Submit Correction",
    cancelButtonLabel: t("cancelButtonLabel") || "Cancel",
    unmatchedErrorFallbackLabel: t("unmatchedErrorFallbackLabel") || "Validation error",
  };

  const handleSubmit = async (data: any) => {
    setValidationErrors([]);

    // Client-side Zod check
    const clientErrors = validateProposedEventCorrection(data);
    if (clientErrors && clientErrors.length > 0) {
      setValidationErrors(clientErrors);
      return;
    }

    try {
      // Build proposedData variables conforming to schema input
      const proposedData = {
        eventName: data.eventName,
        types: data.types,
        categories: data.categories,
        location: data.location,
        organizerName: data.organizerName || undefined,
        contactInfo: data.contactInfo || undefined,
        description: data.description || undefined,
        schedules: data.schedules.map((s: any) => ({
          id: s.id || undefined,
          isMainSchedule: s.isMainSchedule,
          eventStartDate: s.eventStartDate,
          eventEndDate: s.eventEndDate || undefined,
          eventStartTime: s.eventStartTime || undefined,
          eventEndTime: s.eventEndTime || undefined,
          title: s.title || undefined,
          performers: s.performers || undefined,
          location: s.location || undefined,
          ticketPrice: s.ticketPrice || undefined,
        })),
      };

      const response = await submitCorrection({
        eventId: event.id,
        proposedData,
        source: hasExtracted ? CorrectionSource.AiAssisted : CorrectionSource.Manual,
      });

      if (response.submitCorrection.status === "applied") {
        // Patch query cache for getEventBySlug
        queryClient.setQueriesData<any>(
          { queryKey: ["getEventBySlug"] },
          (oldData: any) => {
            if (!oldData || !oldData.eventBySlug) return oldData;
            
            // Rebuild the schedules in old data
            const updatedSchedules = oldData.eventBySlug.schedules.map((s: any) => {
              if (s.isMainSchedule && proposedData.schedules[0]) {
                const propMain = proposedData.schedules[0];
                return {
                  ...s,
                  eventStartDate: propMain.eventStartDate,
                  eventEndDate: propMain.eventEndDate || null,
                  eventStartTime: propMain.eventStartTime || null,
                  eventEndTime: propMain.eventEndTime || null,
                  title: propMain.title || null,
                  performers: propMain.performers || null,
                  location: propMain.location || null,
                  ticketPrice: propMain.ticketPrice || null,
                };
              }
              return s;
            });

            return {
              ...oldData,
              eventBySlug: {
                ...oldData.eventBySlug,
                eventName: proposedData.eventName,
                types: proposedData.types,
                categories: proposedData.categories,
                location: proposedData.location,
                organizerName: proposedData.organizerName || null,
                contactInfo: proposedData.contactInfo || null,
                description: proposedData.description || null,
                schedules: updatedSchedules,
              },
            };
          }
        );

        posthog.capture("event_correction_submitted", {
          eventId: event.id,
          correctionId: response.submitCorrection.id,
          source: hasExtracted ? "ai_assisted" : "manual",
        });

        toast.success(t("successToast") || "Correction submitted successfully");
        onClose();
      } else {
        // status: rejected
        if (response.submitCorrection.validationErrors) {
          setValidationErrors(response.submitCorrection.validationErrors as ValidationErrorItem[]);
        } else {
          toast.error(t("errorToast") || "An unexpected error occurred. Please try again.");
        }
      }
    } catch (err) {
      toast.error(t("errorToast") || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-semibold">
              {t("dialogTitle") || "Correct Event Data"}
            </DialogTitle>
          </DialogHeader>
          <CorrectionForm
            key={formKey}
            initialValues={formValues}
            typeOptions={typeOptions}
            categoryOptions={categoryOptions}
            validationErrors={validationErrors}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isSubmitting={isPending}
            labels={labels}
            headerActions={
              event.sourceSocialMediaAccountProfile?.accountType !== 'CURATOR_GUIDE' ? (
                <AiAssistedCorrectionTrigger
                  labels={aiAssistedLabels}
                  onExtracted={handleExtracted}
                />
              ) : undefined
            }
          />
        </DialogContent>
      </Dialog>
      <BlockingLoader active={isPending} label={t("submittingAnnouncement") || "Submitting correction..."} />
    </>
  );
}
