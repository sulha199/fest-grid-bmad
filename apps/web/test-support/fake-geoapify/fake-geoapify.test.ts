// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { fakeGeoapifyServerEnv } from './env';

const { fakeGeoapifyBody, installFakeGeoapify } = createRequire(import.meta.url)('./index.cjs') as {
  fakeGeoapifyBody: (url: URL) => unknown;
  installFakeGeoapify: (target: { fetch: typeof fetch }) => void;
};

const geoapify = (path: string, query = '') => new URL(`https://api.geoapify.com${path}${query}`);

describe('fake Geoapify responses', () => {
  it('suggests Springfield for an autocomplete or search containing it, in any case', () => {
    for (const path of ['/v1/geocode/autocomplete', '/v1/geocode/search']) {
      const body = fakeGeoapifyBody(geoapify(path, '?text=sPRINGfield%20il')) as { results: Array<{ place_id: string; formatted: string }> };
      expect(body.results).toHaveLength(1);
      expect(body.results[0]).toMatchObject({ place_id: 'e2e-fake-springfield', formatted: expect.stringContaining('Springfield') });
    }
  });

  it('answers a query it has no match for with an empty result, like the real service', () => {
    expect(fakeGeoapifyBody(geoapify('/v1/geocode/autocomplete', '?text=Atlantis'))).toEqual({ results: [] });
    expect(fakeGeoapifyBody(geoapify('/v1/geocode/search'))).toEqual({ results: [] });
  });

  it('serves reverse geocoding and place details for the same place', () => {
    expect(fakeGeoapifyBody(geoapify('/v1/geocode/reverse', '?lat=1&lon=2'))).toMatchObject({ results: [{ city: 'Springfield' }] });
    expect(fakeGeoapifyBody(geoapify('/v2/place-details', '?id=x'))).toMatchObject({ features: [{ properties: { lat: 39.799, lon: -89.644 } }] });
  });

  it('does not stub an endpoint it does not know', () => {
    expect(fakeGeoapifyBody(geoapify('/v1/routing'))).toBeUndefined();
  });
});

describe('installFakeGeoapify', () => {
  it('answers Geoapify URLs locally and passes every other URL to the real fetch', async () => {
    const realFetch = vi.fn(async () => new Response('real'));
    const target = { fetch: realFetch as unknown as typeof fetch };
    installFakeGeoapify(target);

    const stubbed = await target.fetch('https://api.geoapify.com/v1/geocode/autocomplete?text=Springfield&apiKey=k');
    expect(stubbed.status).toBe(200);
    expect(((await stubbed.json()) as { results: unknown[] }).results).toHaveLength(1);

    const unknown = await target.fetch('https://api.geoapify.com/v1/routing');
    expect(unknown.status).toBe(404);

    expect(await (await target.fetch('https://example.com/data')).text()).toBe('real');
    expect(realFetch).toHaveBeenCalledTimes(1);
  });
});

describe('fakeGeoapifyServerEnv', () => {
  it('preloads the stub into the backend without dropping existing NODE_OPTIONS', () => {
    const env = fakeGeoapifyServerEnv({ NODE_OPTIONS: '--max-old-space-size=2048' });
    expect(env.NODE_OPTIONS).toMatch(/^--max-old-space-size=2048 --require ".*fake-geoapify\/index\.cjs"$/);
    expect(env.E2E_FAKE_GEOAPIFY).toBe('1');
  });

  it('gives the backend a placeholder key only when none is configured', () => {
    expect(fakeGeoapifyServerEnv({}).GEOAPIFY_API_KEY).toBe('e2e-fake-geoapify-key');
    expect(fakeGeoapifyServerEnv({ GEOAPIFY_API_KEY: 'k' }).GEOAPIFY_API_KEY).toBe('k');
  });
});
