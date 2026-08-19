import { createServer } from 'node:http';
import { handler } from './lambdas/webhook.js';
import type { APIGatewayProxyEvent } from 'aws-lambda';

const PORT = process.env.WEBHOOK_DEV_PORT ?? 4001;

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString('utf8');

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const event = {
    httpMethod: req.method,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: req.headers as Record<string, string>,
    body,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEvent;

  const result = await handler(event);
  // result.headers may be undefined; ensure object
  const headers = (result as any).headers || {};
  res.writeHead(result.statusCode, headers);
  res.end(result.body);
});

server.listen(PORT, () => {
  console.log(`Bright Data webhook dev server on http://localhost:${PORT}/webhooks/brightdata`);
});
