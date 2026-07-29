import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { corsPreflightResponse, handleGraphQLRequest } from './server';

/**
 * AWS Lambda entry point, wired up behind Amazon API Gateway (HTTP API) per
 * docs/infrastructure.md. Deployed as the "API Logic" Lambda function.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  if (event.requestContext.http.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  return handleGraphQLRequest(event.body);
}
