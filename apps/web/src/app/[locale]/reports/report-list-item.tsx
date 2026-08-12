"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatusBadge, useScopedLocale, useScopedTimezone } from "@festgrid/ui";

export interface ReportListItemProps {
  report: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    event: {
      id: string;
      slug: string;
      eventName: string;
      imageUrl?: string | null;
    };
  };
}

export function ReportListItem({ report }: ReportListItemProps) {
  const tReports = useTranslations("ReportsPage");
  const tReason = useTranslations("ReportReason");
  const tStatus = useTranslations("ReportStatus");

  const [imgError, setImgError] = useState(false);

  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();
  const dateObj = new Date(report.createdAt);

  const formattedDate = (() => {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    try {
      return new Intl.DateTimeFormat(contextLocale, {
        ...options,
        ...(contextTimezone ? { timeZone: contextTimezone } : {}),
      }).format(dateObj);
    } catch {
      try {
        return new Intl.DateTimeFormat(contextLocale, options).format(dateObj);
      } catch {
        return new Intl.DateTimeFormat("en-US", options).format(dateObj);
      }
    }
  })();

  const { event, reason, status } = report;
  const lowercaseReason = reason.toLowerCase();
  const lowercaseStatus = status.toLowerCase();

  const localizedReason = tReason(lowercaseReason, { defaultValue: reason });
  const localizedStatus = tStatus(lowercaseStatus, { defaultValue: status });

  // Map lowercase status to StatusBadge variant
  // Variant union is: "active" | "invalid" | "pending" | "upheld" | "dismissed"
  const badgeVariant = (() => {
    if (lowercaseStatus === "pending") return "pending";
    if (lowercaseStatus === "upheld") return "upheld";
    if (lowercaseStatus === "dismissed") return "dismissed";
    return "pending"; // fallback
  })();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-border rounded-xl bg-card gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {/* Thumbnail Image */}
        <div className="relative h-16 w-16 bg-muted rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-border">
          {!imgError && event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.eventName}
              onError={() => setImgError(true)}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground bg-muted w-full h-full">
              <span className="text-xs font-semibold text-center px-1">
                {event.eventName ? event.eventName.slice(0, 2).toUpperCase() : "??"}
              </span>
            </div>
          )}
        </div>

        {/* Event Details */}
        <div className="space-y-1">
          <Link
            href={`/events/${event.slug}`}
            className="text-lg font-semibold text-foreground hover:text-primary hover:underline line-clamp-1"
          >
            {event.eventName}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{localizedReason}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>{tReports("submittedOn", { date: formattedDate })}</span>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="shrink-0 self-end sm:self-center">
        <StatusBadge variant={badgeVariant} label={localizedStatus} />
      </div>
    </div>
  );
}
