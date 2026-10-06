'use client';

import {
  useQuerySuggestedEventMatchesQuery,
  useResolveSuggestedEventMatchMutation as useGeneratedResolveSuggestedEventMatchMutation,
  useUndoEventMergeMutation as useGeneratedUndoEventMergeMutation,
  SuggestedEventMatchAction,
} from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export function useQuerySuggestedEventMatches(first: number, after: string | undefined, enabled: boolean) {
  return useQuerySuggestedEventMatchesQuery(graphqlClient, { first, after }, { enabled, staleTime: 0, gcTime: 1000 * 60 * 5 });
}

export function useResolveSuggestedEventMatchMutation() {
  const mutation = useGeneratedResolveSuggestedEventMatchMutation(graphqlClient);

  return {
    mutateAsync: async ({ id, action }: { id: string; action: SuggestedEventMatchAction }) => {
      const result = await mutation.mutateAsync({ id, action });
      return result.resolveSuggestedEventMatch;
    },
    isPending: mutation.isPending,
  };
}

export function useUndoEventMergeMutation() {
  const mutation = useGeneratedUndoEventMergeMutation(graphqlClient);

  return {
    mutateAsync: async ({ mergeId }: { mergeId: string }) => {
      const result = await mutation.mutateAsync({ mergeId });
      return result.undoEventMerge;
    },
    isPending: mutation.isPending,
  };
}

export { SuggestedEventMatchAction };
