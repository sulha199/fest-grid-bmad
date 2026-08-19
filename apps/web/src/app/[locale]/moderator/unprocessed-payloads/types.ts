// Types for Unprocessed Payloads (Story 3-4i)
// These types correspond to the GraphQL schema provided by Story 3-4h

export type ValidationError = {
  message: string;
};

export type UnprocessedPayloadContext = {
  source: "APIFY" | "BRIGHT_DATA" | "GEMINI";
  scraperVendor?: string | null;
  accountId?: string | null;
  postUrl?: string | null;
  timestamp: string;
  parserVersion: string;
};

export type UnprocessedScraperPayload = {
  id: string;
  rawPayload: string;
  validationError: ValidationError;
  context: UnprocessedPayloadContext;
  createdAt: string;
  deletedAt?: string | null;
};

export type UnprocessedPayloadEdge = {
  node: UnprocessedScraperPayload;
  cursor: string;
};

export type PageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

export type UnprocessedPayloadConnection = {
  edges: UnprocessedPayloadEdge[];
  pageInfo: PageInfo;
  totalCount?: number;
};

export type UnprocessedPayloadFilters = {
  source?: string | null;
  vendor?: string | null;
  createdAfter?: string | null;
  createdBefore?: string | null;
};

export type ReprocessResult = {
  success: boolean;
  message?: string | null;
};

export type DeleteUnprocessedPayloadResult = boolean;
