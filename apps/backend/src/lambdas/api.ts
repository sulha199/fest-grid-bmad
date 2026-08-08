import { buildServer } from '../server.js';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

const yogaServer = buildServer();

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const url = `https://${event.requestContext.domainName || 'localhost'}${event.path}${
    event.queryStringParameters
      ? '?' + new URLSearchParams(event.queryStringParameters as Record<string, string>).toString()
      : ''
  }`;

  const request = new Request(url, {
    method: event.httpMethod,
    headers: event.headers as Record<string, string>,
    body: event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined,
  });

  const response = await yogaServer.handleRequest(request, { event, context } as any);

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
  };
};
