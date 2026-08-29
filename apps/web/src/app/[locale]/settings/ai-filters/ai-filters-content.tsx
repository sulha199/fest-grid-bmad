"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { SwipeToReveal, useSoftDeleteWithUndo, PageContainer, PageHeader } from "@festgrid/ui";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { useRouter } from "@/i18n/navigation";
import { graphqlClient } from "@/lib/graphql-client";
import { useGetMyAiEventFiltersQuery, useDeleteAiEventFilterMutation, SoftDeleteAction } from "@/generated/graphql";
import { Sparkles, Trash2, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { renderAIFilterSummary } from "@festgrid/domain/ai-event-filters";

export function AiFiltersContent() {
  const t = useTranslations("MyAIFiltersPage");
  const tSummary = useTranslations("AIFilterSummary");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, isLoading: authLoading } = useAuthSession();

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  // Query saved AI filters
  const { data, isLoading, error } = useGetMyAiEventFiltersQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
    }
  );

  const { mutateAsync: deleteAIEventFilter } = useDeleteAiEventFilterMutation(graphqlClient);

  const { isPending, markPending } = useSoftDeleteWithUndo<string>({
    onExpire: (id) => {
      // Splice from React Query cache immediately without refetch
      queryClient.setQueryData(["getMyAIEventFilters"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          myAIEventFilters: (old.myAIEventFilters || []).filter((f: any) => f.id !== id),
        };
      });
    },
  });

  const filters = data?.myAIEventFilters || [];

  const handleDelete = async (filterId: string) => {
    try {
      // Call deleteAIEventFilter(DELETE) immediately
      await deleteAIEventFilter({
        id: filterId,
        action: SoftDeleteAction.Delete,
      });

      // Fire analytics event saved_ai_filter_deleted if posthog is active
      const posthog = (window as any).posthog;
      if (posthog) {
        posthog.capture("saved_ai_filter_deleted", {
          filterId,
        });
      }

      // Enter pending state with RESTORE callback
      markPending(
        filterId,
        async () => {
          try {
            await deleteAIEventFilter({
              id: filterId,
              action: SoftDeleteAction.Restore,
            });
          } catch (err) {
            console.error("Failed to restore AI filter", err);
            throw err;
          }
        },
        {
          message: t("removedToast") || "AI Filter deleted",
          undoLabel: t("undoLabel") || "Undo",
        }
      );
    } catch (err) {
      console.error("Failed to delete AI filter", err);
    }
  };

  const handleRowClick = (filter: any) => {
    if (isPending(filter.id)) return;
    const filterParam = encodeURIComponent(JSON.stringify(filter.resolvedFilter));
    router.push(`/?ai_filter=${filterParam}`);
  };

  const summaryLabels = useMemo(() => {
    const anchors = {
      TODAY: tSummary("anchors.TODAY"),
      THIS_WEEK: tSummary("anchors.THIS_WEEK"),
      THIS_MONTH: tSummary("anchors.THIS_MONTH"),
    };
    const units = {
      DAY: tSummary("units.DAY"),
      WEEK: tSummary("units.WEEK"),
      MONTH: tSummary("units.MONTH"),
    };
    const daysOfWeek = {
      MON: tSummary("daysOfWeek.MON"),
      TUE: tSummary("daysOfWeek.TUE"),
      WED: tSummary("daysOfWeek.WED"),
      THU: tSummary("daysOfWeek.THU"),
      FRI: tSummary("daysOfWeek.FRI"),
      SAT: tSummary("daysOfWeek.SAT"),
      SUN: tSummary("daysOfWeek.SUN"),
    };

    return {
      noFilter: tSummary("noFilter"),
      accountIdTemplate: tSummary.raw("accountIdTemplate"),
      typesPrefix: tSummary("typesPrefix"),
      categoriesPrefix: tSummary("categoriesPrefix"),
      keywordTemplate: tSummary.raw("keywordTemplate"),
      dateRangeTemplate: tSummary.raw("dateRangeTemplate"),
      nearMe: tSummary("nearMe"),
      nearMeWithRadiusTemplate: tSummary.raw("nearMeWithRadiusTemplate"),
      venueTypeTemplate: tSummary.raw("venueTypeTemplate"),
      freeEventsOnly: tSummary("freeEventsOnly"),
      paidEventsOnly: tSummary("paidEventsOnly"),
      caveatPrefix: tSummary("caveatPrefix"),
      caveatSeparator: tSummary("caveatSeparator"),
      anchors,
      units,
      daysOfWeek,
    };
  }, [tSummary]);

  if (authLoading || isLoading) {
    return (
      <PageContainer fullWidth={false}>
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-muted rounded-md w-1/4" />
          <div className="h-32 bg-muted rounded-md w-full" />
          <div className="h-32 bg-muted rounded-md w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer fullWidth={false}>
        <PageHeader title={t("title")} />
        <div className="flex flex-col items-center justify-center p-12 border rounded-lg text-center space-y-4 bg-card text-card-foreground">
          <p className="text-destructive font-medium">{t("errorState")}</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer fullWidth={false}>
      <PageHeader title={t("title")} />

      {filters.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center space-y-4 bg-card text-card-foreground">
          <div className="inline-flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-950/40 rounded-full text-blue-600 dark:text-blue-400 mb-2">
            <Sparkles className="w-8 h-8" />
          </div>
          <p className="text-muted-foreground font-medium">{t("emptyState")}</p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <Sparkles className="h-4 w-4" />
            {t("ctaLabel")}
          </button>
        </div>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm">
          {filters.map((filter: any) => {
            const pending = isPending(filter.id);
            const rendered = renderAIFilterSummary(filter.resolvedFilter, [], summaryLabels);

            return (
              <SwipeToReveal
                key={filter.id}
                disabled={pending}
                action={
                  <div className="bg-destructive text-destructive-foreground h-full px-6 flex items-center gap-2 font-medium">
                    <Trash2 className="h-4 w-4" />
                    <span>{t("deleteButtonLabel")}</span>
                  </div>
                }
                onAction={() => handleDelete(filter.id)}
              >
                <div
                  onClick={() => handleRowClick(filter)}
                  className={`flex items-center justify-between p-4 bg-background hover:bg-muted/30 transition-colors cursor-pointer ${
                    pending ? "opacity-40 pointer-events-none" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate italic">
                        &ldquo;{filter.prompt}&rdquo;
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm tracking-tight leading-relaxed">
                      {rendered.summary}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Desktop non-touch fallback trash button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(filter.id);
                      }}
                      disabled={pending}
                      className="p-2 hover:bg-accent text-destructive hover:text-destructive-foreground rounded-md transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </SwipeToReveal>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
