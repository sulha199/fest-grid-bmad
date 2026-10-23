import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useResolvePromptToEventFilterMutation, useSaveAiEventFilterMutation, EventFilterInput } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import { useApiKeyStatus } from '@/features/onboarding/use-has-api-key';
import {
  renderFilterExpressionSummary,
  expressionFromFlatFilter,
  flatFilterFromExpression,
  stripNullNodeKeys,
  validateFilterNode,
} from '@festgrid/domain/ai-event-filters';
import type { FilterNode } from '@festgrid/domain/ai-event-filters';

/** The flat manual-filter equivalent of an expression, or `null` when the expression (OR / NOT /
 * repeated fields) has no flat form. */
function tryFlatFilter(expression: FilterNode): EventFilterInput | null {
  try {
    return flatFilterFromExpression(expression) as EventFilterInput;
  } catch {
    return null;
  }
}

function hasNoConditions(expression: FilterNode): boolean {
  return 'op' in expression && expression.op === 'AND' && expression.children.length === 0;
}

export function useAIFilter() {
  const { hasApiKey, isLoading: isLoadingKey } = useApiKeyStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resolvedData, setResolvedData] = useState<{
    resolvedFilter: EventFilterInput;
    expression: FilterNode;
    caveats: string[];
    prompt: string;
  } | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tFilterHub = useTranslations('FilterHub');
  const tSummary = useTranslations('AIFilterSummary');

  const [aiFilterStr, setAiFilterStr] = useQueryState('ai_filter', parseAsString);
  const [aiCaveatsStr, setAiCaveatsStr] = useQueryState('ai_caveats', parseAsString);
  const [aiExpressionStr, setAiExpressionStr] = useQueryState('ai_expression', parseAsString);

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

  const aiExpression = useMemo(() => {
    if (!aiExpressionStr) return null;
    try {
      // The URL param is untrusted input, and URLs shared/bookmarked before the null-padding fix
      // still carry GraphQL's `op: null` / `children: null` / `child: null` keys -- validate (which
      // also strips them) instead of casting, so a malformed or old-shape value degrades to "no
      // expression" rather than crashing the summary/query builders.
      const validation = validateFilterNode(JSON.parse(aiExpressionStr));
      return validation.valid ? validation.node : null;
    } catch {
      return null;
    }
  }, [aiExpressionStr]);

  // The URL carries an `ai_expression` that did not survive validation (truncated by a messenger,
  // over the limits, an old shape): the page then falls back to the flat `ai_filter`, which for a
  // compound prompt is only an approximation -- say so instead of silently showing a different filter.
  const aiExpressionInvalid = !!aiExpressionStr && aiExpression === null;

  // What "Edit / Expand" can turn the filter into: manual controls only represent a flat
  // filter. A compound (OR / NOT) expression has no such form, so it cannot be expanded.
  const flatForExpand = useMemo<EventFilterInput | null>(() => {
    if (aiExpression) return tryFlatFilter(aiExpression);
    return aiFilter;
  }, [aiExpression, aiFilter]);

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
      unitsSingular: {
        DAY: tSummary('unitsSingular.DAY'),
        WEEK: tSummary('unitsSingular.WEEK'),
        MONTH: tSummary('unitsSingular.MONTH'),
      },
      restOfMonth: tSummary('restOfMonth'),
      daysOfWeek,
      and: tSummary('and'),
      or: tSummary('or'),
      not: tSummary('not'),
      weekends: tSummary('weekends'),
      weekdays: tSummary('weekdays'),
      dateRangeSpanOnlyTemplate: tSummary.raw('dateRangeSpanOnlyTemplate'),
      dateRangeSpanExtensionTemplate: tSummary.raw('dateRangeSpanExtensionTemplate'),
      temporalStatus: { TODAY: tSummary('temporalStatus.TODAY'), UPCOMING: tSummary('temporalStatus.UPCOMING') },
    };
  }, [tSummary]);

  const summaryResult = useMemo(() => {
    if (!aiFilter && !aiExpression) return null;
    const node = aiExpression ?? expressionFromFlatFilter(aiFilter ?? {});
    const caveats = aiExpressionInvalid ? [...(aiCaveats ?? []), tSummary('expressionInvalidCaveat')] : aiCaveats;
    return renderFilterExpressionSummary(node, caveats, summaryLabels);
  }, [aiFilter, aiExpression, aiExpressionInvalid, aiCaveats, summaryLabels, tSummary]);

  const resolvedSummaryResult = useMemo(() => {
    if (!resolvedData) return null;
    return renderFilterExpressionSummary(resolvedData.expression, resolvedData.caveats, summaryLabels);
  }, [resolvedData, summaryLabels]);

  const { mutate: resolvePrompt, isPending: isLoading } = useResolvePromptToEventFilterMutation(graphqlClient, {
    onSuccess: (data, variables) => {
      setError(null);
      // The generated GraphQL type is a loosely-typed recursive shape: the schema's `FilterNode`
      // can't express the domain's discriminated union, and GraphQL serializes EVERY declared key
      // on every node (absent ones as explicit `null`: `{ op: null, field: "type", children: null,
      // child: null, ... }`). The backend has already validated the tree, so only that null padding
      // needs removing -- left in, it crashes the summary renderer and query compiler.
      const expression = stripNullNodeKeys(data.resolvePromptToEventFilter.expression) as FilterNode;
      // `ai_filter` doubles as the "an AI filter is active" marker and the flat fallback; a filter
      // with no flat form still gets `{}`, never the string "null".
      setAiFilterStr(JSON.stringify(data.resolvePromptToEventFilter.resolvedFilter ?? {}));
      setAiCaveatsStr(JSON.stringify(data.resolvePromptToEventFilter.caveats));
      setAiExpressionStr(JSON.stringify(expression));
      setResolvedData({
        resolvedFilter: data.resolvePromptToEventFilter.resolvedFilter,
        expression,
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
      expression: resolvedData.expression,
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
    setAiExpressionStr(null);
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
    setAiExpressionStr(null);
  };

  const handleAIExpand = () => {
    if (!flatForExpand) return;
    if (flatForExpand.keyword) {
      setQ(flatForExpand.keyword);
    }
    if (flatForExpand.types) {
      setTypes(flatForExpand.types);
    }
    if (flatForExpand.categories) {
      setCategories(flatForExpand.categories);
    }
    setAiFilterStr(null);
    setAiCaveatsStr(null);
    setAiExpressionStr(null);
  };

  // Only auto-expand when `q` changes while an AI filter was ALREADY active (the user typed into
  // manual search). Two situations must NOT collapse the filter:
  //  - the render where `aiFilterStr` itself just changed (a fresh resolve or a clear) --
  //    otherwise a freshly-resolved filter with a keyword field would always mismatch the
  //    still-stale `q` and immediately self-collapse back to manual mode;
  //  - a page load (or shared/bookmarked link) that arrives with `ai_filter` already in the URL --
  //    `q` is empty there, so comparing it to the filter's keyword would read as a user edit and
  //    silently turn the AI filter into manual controls. Tracking that `q` actually CHANGED (rather
  //    than merely differs) also keeps this correct under React StrictMode's double-run of effects.
  const prevAiFilterStrRef = useRef(aiFilterStr);
  const prevQRef = useRef(q);
  useEffect(() => {
    const aiFilterJustChanged = prevAiFilterStrRef.current !== aiFilterStr;
    const qChanged = prevQRef.current !== q;
    prevAiFilterStrRef.current = aiFilterStr;
    prevQRef.current = q;
    // A filter with no flat form cannot collapse into manual controls; typed search is ANDed onto
    // it by the query builder instead.
    if (aiFilterJustChanged || !qChanged || !flatForExpand) return;
    const currentQ = q || '';
    const filterQ = flatForExpand.keyword || '';
    if (currentQ !== filterQ) {
      handleAIExpand();
    }
  }, [q, aiFilterStr, flatForExpand]);

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
    examplePromptsLabel: tFilterHub('aiOverlayExamplePromptsLabel'),
  };

  const examplePrompts = useMemo(
    () => [
      tFilterHub('aiOverlayExamplePrompt1'),
      tFilterHub('aiOverlayExamplePrompt2'),
      tFilterHub('aiOverlayExamplePromptGrouped'),
    ],
    [tFilterHub]
  );

  return {
    hasApiKey: hasApiKey && !isLoadingKey,
    activeFilter: aiFilter,
    activeExpression: aiExpression,
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
      onAIExpand: flatForExpand ? handleAIExpand : undefined,
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
      canSave: !!resolvedData && !hasNoConditions(resolvedData.expression),
      isSaving,
      saveSuccess,
      saveError,
      onApply: handleApply,
      onRePrompt: handleRePrompt,
      examplePrompts,
    },
  };
}
