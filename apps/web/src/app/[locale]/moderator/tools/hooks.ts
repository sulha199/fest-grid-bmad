'use client';

import { useQueryActorRunsQuery, useReplayActorRunMutation as useGeneratedReplayActorRunMutation } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import type { ActorRunFilters } from '@/gql/graphql';

export function useQueryActorRuns(
  filters: ActorRunFilters | undefined,
  cursor: string | undefined,
  pageSize: number,
  enabled: boolean
) {
  return useQueryActorRunsQuery(
    graphqlClient,
    { filters: filters || {}, first: pageSize, after: cursor },
    { enabled, staleTime: 0, gcTime: 1000 * 60 * 5 }
  );
}

export function useReplayActorRunMutation() {
  const mutation = useGeneratedReplayActorRunMutation(graphqlClient);

  return {
    mutateAsync: async ({ actorRunId }: { actorRunId: string }) => {
      const result = await mutation.mutateAsync({ actorRunId });
      return result.replayActorRun;
    },
    isPending: mutation.isPending,
  };
}
