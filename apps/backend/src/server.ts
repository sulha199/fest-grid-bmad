import { executeEventQuery } from './schema';

export interface GraphQLHttpRequestBody {
  query?: string;
  variables?: Record<string, unknown>;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const JSON_CONTENT_TYPE = 'application/json';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGIN ?? '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(statusCode: number, payload: unknown): HttpResponse {
  return {
    statusCode,
    headers: { 'Content-Type': JSON_CONTENT_TYPE, ...corsHeaders() },
    body: JSON.stringify(payload),
  };
}

export function corsPreflightResponse(): HttpResponse {
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}

/**
 * Framework-agnostic core used by both the AWS Lambda handler and the local
 * dev HTTP server so the request/response mapping logic is written once.
 */
export async function handleGraphQLRequest(rawBody: string | null | undefined): Promise<HttpResponse> {
  if (!rawBody) {
    return jsonResponse(400, { error: 'Request body is required.' });
  }

  let payload: GraphQLHttpRequestBody;
  try {
    payload = JSON.parse(rawBody) as GraphQLHttpRequestBody;
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' });
  }

  if (!payload.query) {
    return jsonResponse(400, { error: 'A GraphQL "query" field is required.' });
  }

  const result = await executeEventQuery(payload.query, payload.variables);
  return jsonResponse(result.errors?.length ? 400 : 200, result);
}
