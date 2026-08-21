// Hooks for Unprocessed Payloads GraphQL operations (Story 3-4i)
import { useQuery, useMutation, queryOptions } from "@tanstack/react-query"
import { graphqlClient } from "@/lib/graphql-client"
import { gql } from "graphql-request"
import type {
  UnprocessedPayloadConnection,
  UnprocessedPayloadFilters,
  ReprocessResult,
  DeleteUnprocessedPayloadResult,
} from "./types"

type QueryUnprocessedPayloadsResponse = {
  queryUnprocessedPayloads: UnprocessedPayloadConnection
}

const QUERY_UNPROCESSED_PAYLOADS = gql`
  query queryUnprocessedPayloads($filters: UnprocessedPayloadFilters, $cursor: String, $limit: Int) {
    queryUnprocessedPayloads(filters: $filters, after: $cursor, first: $limit) {
      edges {
        node {
          id
          rawPayload
          validationError {
            message
          }
          context {
            source
            scraperVendor
            accountId
            postUrl
            timestamp
            parserVersion
          }
          createdAt
          deletedAt
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
`

const MUTATION_REPROCESS_PAYLOAD = gql`
  mutation reprocessPayload($payloadId: ID!, $parserVersion: String!) {
    reprocessPayload(payloadId: $payloadId, parserVersion: $parserVersion) {
      success
      message
    }
  }
`

const MUTATION_DELETE_UNPROCESSED_PAYLOAD = gql`
  mutation deleteUnprocessedPayload($payloadId: ID!) {
    deleteUnprocessedPayload(payloadId: $payloadId)
  }
`

function unprocessedPayloadsQueryOptions(
  filters?: UnprocessedPayloadFilters,
  cursor?: string,
  limit?: number,
  enabled: boolean = true
) {
  return queryOptions({
    queryKey: ["unprocessedPayloads", filters, cursor, limit] as const,
    queryFn: async () => {
      return graphqlClient.request<QueryUnprocessedPayloadsResponse>(QUERY_UNPROCESSED_PAYLOADS, {
        filters: filters || {},
        cursor: cursor || undefined,
        limit: limit || 20,
      })
    },
    enabled,
  })
}

export function useUnprocessedPayloadsQuery(
  filters?: UnprocessedPayloadFilters,
  cursor?: string,
  limit?: number,
  enabled: boolean = true
) {
  return useQuery(unprocessedPayloadsQueryOptions(filters, cursor, limit, enabled))
}

export function useReprocessPayloadMutation() {
  return useMutation<ReprocessResult, Error, { payloadId: string; parserVersion: string }>({
    mutationFn: async ({ payloadId, parserVersion }) => {
      const result = await graphqlClient.request(MUTATION_REPROCESS_PAYLOAD, {
        payloadId,
        parserVersion,
      })
      return result.reprocessPayload
    },
  })
}

export function useDeleteUnprocessedPayloadMutation() {
  return useMutation<DeleteUnprocessedPayloadResult, Error, { payloadId: string }>({
    mutationFn: async ({ payloadId }) => {
      const result = await graphqlClient.request(MUTATION_DELETE_UNPROCESSED_PAYLOAD, {
        payloadId,
      })
      return result.deleteUnprocessedPayload
    },
  })
}
