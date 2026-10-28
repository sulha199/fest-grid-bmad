import { join } from 'node:path';

/**
 * Env for the E2E backend so its Geoapify calls are answered by ./index.cjs instead of the real API.
 * Only meaningful together with fake auth's throwaway local stack (E2E_FAKE_AUTH=1): the backend gets a
 * placeholder key unless one is set, and no request to api.geoapify.com leaves the machine.
 */
export function fakeGeoapifyServerEnv(base: Record<string, string | undefined> = process.env): Record<string, string> {
  const preload = join(__dirname, 'index.cjs');
  return {
    E2E_FAKE_GEOAPIFY: '1',
    GEOAPIFY_API_KEY: base.GEOAPIFY_API_KEY || 'e2e-fake-geoapify-key',
    NODE_OPTIONS: [base.NODE_OPTIONS, `--require ${JSON.stringify(preload)}`].filter(Boolean).join(' '),
  };
}
