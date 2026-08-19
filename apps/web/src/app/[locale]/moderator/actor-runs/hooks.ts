'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { graphql } from '@/gql';
import { request } from 'graphql-request';
import type { ActorRunFilters } from '@/gql/graphql';

const GRAPHQL_ENDPOINT = '/api/graphql';

const queryActorRunsDocument = graphql(`
  query queryActorRuns($filters: ActorRunFilters, $first: Int, $after: String) {
    queryActorRuns(filters: $filters, first: $first, after: $after) {
      edges {
        node {
          id
          vendor
          triggerMode
          profileId
          runId
          status
          rawInput
          rawOutput
          itemCount
          errorMessage
          startedAt
          completedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

const replayActorRunDocument = graphql(`
  mutation replayActorRun($actorRunId: ID!) {
    replayActorRun(actorRunId: $actorRunId) {
      success
      postsPersisted
      message
    }
  }
`);

export function useQueryActorRuns(
  filters: ActorRunFilters | undefined,
  cursor: string | undefined,
  pageSize: number,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['actorRuns', filters, cursor],
    queryFn: async () => {
      const response = await request(GRAPHQL_ENDPOINT, queryActorRunsDocument, {
        filters: filters || {},
        first: pageSize,
        after: cursor,
      });
      return response;
    },
    enabled,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });
}

export function useReplayActorRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actorRunId }: { actorRunId: string }) => {
      const response = await request(GRAPHQL_ENDPOINT, replayActorRunDocument, {
        actorRunId,
      });
      return response.replayActorRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actorRuns'] });
    },
  });
}
