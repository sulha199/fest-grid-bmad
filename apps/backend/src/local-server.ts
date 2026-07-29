import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { corsPreflightResponse, handleGraphQLRequest } from './server';

// Root .env is the primary source of environment variables; package-local
// .env only contains overrides (matches packages/database/env.ts convention).
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config({ path: resolve(__dirname, '../.env'), override: true });

const PORT = Number(process.env.BACKEND_PORT ?? 4001);

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    const response = corsPreflightResponse();
    res.writeHead(response.statusCode, response.headers);
    res.end(response.body);
    return;
  }

  if (req.method !== 'POST' || req.url !== '/graphql') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. POST a GraphQL request to /graphql.' }));
    return;
  }

  let rawBody = '';
  req.on('data', (chunk: Buffer) => {
    rawBody += chunk;
  });
  req.on('end', () => {
    handleGraphQLRequest(rawBody)
      .then((response) => {
        res.writeHead(response.statusCode, response.headers);
        res.end(response.body);
      })
      .catch((error: unknown) => {
        console.error('Unhandled error while processing GraphQL request', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error.' }));
      });
  });
});

server.listen(PORT, () => {
  console.log(`FestGrid backend GraphQL server listening on http://localhost:${PORT}/graphql`);
});
