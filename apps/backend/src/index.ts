import { createServer } from 'node:http';
import { buildServer } from './server.js';
import { loadBackendEnv } from './env.js';

const env = loadBackendEnv();
const yoga = buildServer();

const server = createServer(yoga);

server.listen(env.port, () => {
  console.log(`Server is running on http://localhost:${env.port}/graphql`);
});
