"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useMyReportsQuery } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useRouter } from "@/i18n/navigation";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { usePostHog } from "@festgrid/analytics";
import { ReportListItem } from "./report-list-item";

export function ReportsContent() {
  const t = useTranslations("ReportsPage");
  const router = useRouter();
  const posthog = usePostHog();
  const { session, isLoading: isAuthLoading } = useAuthSession();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!isAuthLoading && !session) {
      router.push("/login");
    }
  }, [isAuthLoading, session, router]);

  // Fetch submitted reports
  const { data, status, error } = useMyReportsQuery(
    graphqlClient,
    {},
    {
      enabled: !!session && !isAuthLoading,
    }
  );

  // Track page view event via PostHog once per successful load
  const hasReportedViewRef = useRef(false);
  const reportsList = data?.myReports;
  const reportsCount = reportsList?.length;

  useEffect(() => {
    if (status === "success" && reportsList !== undefined && !hasReportedViewRef.current) {
      hasReportedViewRef.current = true;
      posthog.capture("reports_page_viewed", {
        reportCount: reportsCount || 0,
      });
    }
  }, [status, reportsList, reportsCount, posthog]);

  if (!session) {
    return null;
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {status === "pending" && (
        <div className="space-y-4" aria-busy="true" aria-label={t("loadingLabel")}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card animate-pulse h-[98px]"
            >
              <div className="h-16 w-16 bg-muted rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
              <div className="h-6 bg-muted rounded w-20 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-12 border border-destructive/20 bg-destructive/5 rounded-xl text-destructive">
          <p className="font-semibold">{t("errorState")}</p>
          {!!error && <p className="text-xs mt-2 text-muted-foreground">{error.message}</p>}
        </div>
      )}

      {status === "success" && (!reportsList || reportsList.length === 0) && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl bg-card">
          <p className="text-muted-foreground text-lg">{t("emptyState")}</p>
        </div>
      )}

      {status === "success" && reportsList && reportsList.length > 0 && (
        <div className="flex flex-col gap-4">
          {reportsList.map((report) => (
            <ReportListItem key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
