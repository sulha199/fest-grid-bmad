import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useResolvePromptToEventFilterMutation, useSaveAiEventFilterMutation, EventFilterInput } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useApiKeyStatus } from '@/features/onboarding/use-has-api-key';
import { renderAIFilterSummary } from '@festgrid/domain/ai-event-filters';

export function useAIFilter() {
  const { hasApiKey, isLoading: isLoadingKey } = useApiKeyStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resolvedData, setResolvedData] = useState<{
    resolvedFilter: EventFilterInput;
    caveats: string[];
    prompt: string;
  } | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tFilterHub = useTranslations('FilterHub');
  const tSummary = useTranslations('AIFilterSummary');

  const [aiFilterStr, setAiFilterStr] = useQueryState('ai_filter', parseAsString);
  const [aiCaveatsStr, setAiCaveatsStr] = useQueryState('ai_caveats', parseAsString);

  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''));
  const [types, setTypes] = useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]));
  const [categories, setCategories] = useQueryState('categories', parseAsArrayOf(parseAsString).withDefault([]));

  const aiFilter = useMemo(() => {
    if (!aiFilterStr) return null;
    try {
      return JSON.parse(aiFilterStr) as EventFilterInput;
    } catch {
      return null;
    }
  }, [aiFilterStr]);

  const aiCaveats = useMemo(() => {
    if (!aiCaveatsStr) return null;
    try {
      return JSON.parse(aiCaveatsStr) as string[];
    } catch {
      return null;
    }
  }, [aiCaveatsStr]);

  const summaryLabels = useMemo(() => {
    const anchors = {
      TODAY: tSummary('anchors.TODAY'),
      THIS_WEEK: tSummary('anchors.THIS_WEEK'),
      THIS_MONTH: tSummary('anchors.THIS_MONTH'),
    };
    const units = {
      DAY: tSummary('units.DAY'),
      WEEK: tSummary('units.WEEK'),
      MONTH: tSummary('units.MONTH'),
    };
    const daysOfWeek = {
      MON: tSummary('daysOfWeek.MON'),
      TUE: tSummary('daysOfWeek.TUE'),
      WED: tSummary('daysOfWeek.WED'),
      THU: tSummary('daysOfWeek.THU'),
      FRI: tSummary('daysOfWeek.FRI'),
      SAT: tSummary('daysOfWeek.SAT'),
      SUN: tSummary('daysOfWeek.SUN'),
    };

    return {
      noFilter: tSummary('noFilter'),
      accountIdTemplate: tSummary.raw('accountIdTemplate'),
      typesPrefix: tSummary('typesPrefix'),
      categoriesPrefix: tSummary('categoriesPrefix'),
      keywordTemplate: tSummary.raw('keywordTemplate'),
      dateRangeTemplate: tSummary.raw('dateRangeTemplate'),
      nearMe: tSummary('nearMe'),
      nearMeWithRadiusTemplate: tSummary.raw('nearMeWithRadiusTemplate'),
      venueTypeTemplate: tSummary.raw('venueTypeTemplate'),
      freeEventsOnly: tSummary('freeEventsOnly'),
      paidEventsOnly: tSummary('paidEventsOnly'),
      caveatPrefix: tSummary('caveatPrefix'),
      caveatSeparator: tSummary('caveatSeparator'),
      anchors,
      units,
      daysOfWeek,
    };
  }, [tSummary]);

  const summaryResult = useMemo(() => {
    if (!aiFilter) return null;
    return renderAIFilterSummary(aiFilter, aiCaveats, summaryLabels);
  }, [aiFilter, aiCaveats, summaryLabels]);

  const resolvedSummaryResult = useMemo(() => {
    if (!resolvedData) return null;
    return renderAIFilterSummary(resolvedData.resolvedFilter, resolvedData.caveats, summaryLabels);
  }, [resolvedData, summaryLabels]);

  const { mutate: resolvePrompt, isPending: isLoading } = useResolvePromptToEventFilterMutation(graphqlClient, {
    onSuccess: (data, variables) => {
      setError(null);
      setAiFilterStr(JSON.stringify(data.resolvePromptToEventFilter.resolvedFilter));
      setAiCaveatsStr(JSON.stringify(data.resolvePromptToEventFilter.caveats));
      setResolvedData({
        resolvedFilter: data.resolvePromptToEventFilter.resolvedFilter,
        caveats: data.resolvePromptToEventFilter.caveats,
        prompt: variables.prompt,
      });
    },
    onError: (err: any) => {
      console.error('AI filter prompt resolution failed:', err);
      setError(err?.response?.errors?.[0]?.message || err?.message || 'Resolution failed');
    },
  });

  const { mutate: saveFilter, isPending: isSaving } = useSaveAiEventFilterMutation(graphqlClient, {
    onSuccess: () => {
      setSaveSuccess(true);
      setSaveError(null);
    },
    onError: (err: any) => {
      console.error('Failed to save AI filter:', err);
      setSaveError(err?.response?.errors?.[0]?.message || err?.message || 'Failed to save filter');
    },
  });

  const handleSave = () => {
    if (!resolvedData) return;
    setSaveError(null);
    saveFilter({
      prompt: resolvedData.prompt,
      resolvedFilter: resolvedData.resolvedFilter,
    });
  };

  const handleApply = () => {
    setResolvedData(null);
    setSaveError(null);
    setSaveSuccess(false);
    setIsOpen(false);
  };

  const handleRePrompt = () => {
    setAiFilterStr(null);
    setAiCaveatsStr(null);
    setResolvedData(null);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setResolvedData(null);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleAIClear = () => {
    setAiFilterStr(null);
    setAiCaveatsStr(null);
  };

  const handleAIExpand = () => {
    if (!aiFilter) return;
    if (aiFilter.keyword) {
      setQ(aiFilter.keyword);
    }
    if (aiFilter.types) {
      setTypes(aiFilter.types);
    }
    if (aiFilter.categories) {
      setCategories(aiFilter.categories);
    }
    setAiFilterStr(null);
    setAiCaveatsStr(null);
  };

  // Only auto-expand when `q` changes while an AI filter was ALREADY active (the user typed into
  // manual search). Skip the check on the render where `aiFilterStr` itself just changed (a fresh
  // resolve or a clear) -- otherwise a freshly-resolved filter with a keyword field would always
  // mismatch the still-stale `q` and immediately self-collapse back to manual mode.
  const prevAiFilterStrRef = useRef(aiFilterStr);
  useEffect(() => {
    const aiFilterJustChanged = prevAiFilterStrRef.current !== aiFilterStr;
    prevAiFilterStrRef.current = aiFilterStr;
    if (aiFilterJustChanged || !aiFilter) return;
    const currentQ = q || '';
    const filterQ = aiFilter.keyword || '';
    if (currentQ !== filterQ) {
      handleAIExpand();
    }
  }, [q, aiFilterStr, aiFilter]);

  const overlayLabels = {
    title: tFilterHub('aiOverlayTitle'),
    description: tFilterHub('aiOverlayDescription'),
    placeholder: tFilterHub('aiOverlayPlaceholder'),
    submit: tFilterHub('aiOverlaySubmit'),
    cancel: tFilterHub('aiOverlayCancel'),
    errorTitle: tFilterHub('aiOverlayErrorTitle'),
    saveFilter: tFilterHub('aiOverlaySave'),
    saving: tFilterHub('aiOverlaySaving'),
    saveSuccess: tFilterHub('aiOverlaySaveSuccess'),
    saveError: tFilterHub('aiOverlaySaveError'),
    resolvedSummaryTitle: tFilterHub('aiOverlayResolvedSummaryTitle'),
    rePrompt: tFilterHub('aiOverlayRePrompt'),
  };

  return {
    hasApiKey: hasApiKey && !isLoadingKey,
    activeFilter: aiFilter,
    isLoading,
    filterHubProps: {
      showAITrigger: hasApiKey && !isLoadingKey,
      onAITriggerClick: () => {
        setError(null);
        setResolvedData(null);
        setSaveError(null);
        setSaveSuccess(false);
        setIsOpen(true);
      },
      aiFilterSummary: summaryResult?.summary,
      aiCaveatsText: summaryResult?.caveatsText,
      onAIClear: handleAIClear,
      onAIExpand: handleAIExpand,
    },
    overlayProps: {
      isOpen,
      onClose: handleClose,
      onSubmit: (prompt: string) => {
        setError(null);
        setSaveError(null);
        setSaveSuccess(false);
        resolvePrompt({ prompt });
      },
      isLoading,
      error,
      labels: overlayLabels,
      resolvedSummary: resolvedSummaryResult?.summary || null,
      resolvedCaveats: resolvedSummaryResult?.caveatsText || null,
      onSave: handleSave,
      isSaving,
      saveSuccess,
      saveError,
      onApply: handleApply,
      onRePrompt: handleRePrompt,
    },
  };
}
