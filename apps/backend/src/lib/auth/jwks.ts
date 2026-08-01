import { createRemoteJWKSet } from 'jose';
import { loadBackendEnv } from '../../env.js';

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export function getRemoteJwks() {
  if (!cachedJwks) {
    const env = loadBackendEnv();
    if (!env.supabaseUrl) {
      throw new Error('SUPABASE_URL is not defined in environment variables.');
    }
    const jwksUrl = new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`);
    cachedJwks = createRemoteJWKSet(jwksUrl);
  }
  return cachedJwks;
}
