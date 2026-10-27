'use strict';

/**
 * Stand-in for Geoapify in the E2E backend. Loaded with `node --require` (see `fakeGeoapifyServerEnv`
 * in ./env.ts), it wraps the backend's global `fetch` so calls to api.geoapify.com get a canned answer
 * instead of leaving the machine. Every other URL goes through the real `fetch` untouched.
 *
 * Plain CommonJS on purpose: `--require` loads it before the backend (tsx) starts, so it can't be
 * TypeScript. Nothing in the application changes -- the backend still believes it is talking to Geoapify.
 *
 * It answers the four endpoints `apps/backend/src/lib/geolocation/geoapify-client.ts` calls, with one
 * known place ("Springfield") and an empty result for anything else, which is how the real service
 * answers a query it has no match for.
 */

const GEOAPIFY_HOST = 'api.geoapify.com';

const SPRINGFIELD = {
  place_id: 'e2e-fake-springfield',
  formatted: 'Springfield, IL, United States of America',
  name: 'Springfield',
  lat: 39.799,
  lon: -89.644,
  city: 'Springfield',
  state: 'Illinois',
  country_code: 'us',
  timezone: { name: 'America/Chicago' },
  rank: { confidence: 1, match_type: 'full_match' },
};

function mentionsSpringfield(text) {
  return typeof text === 'string' && text.toLowerCase().includes('springfield');
}

/** The JSON body Geoapify would return for `url`, or undefined when the path isn't one we stand in for. */
function fakeGeoapifyBody(url) {
  switch (url.pathname) {
    case '/v1/geocode/autocomplete':
    case '/v1/geocode/search':
      return { results: mentionsSpringfield(url.searchParams.get('text')) ? [SPRINGFIELD] : [] };
    case '/v1/geocode/reverse':
      return { results: [SPRINGFIELD] };
    case '/v2/place-details':
      return { features: [{ properties: { ...SPRINGFIELD, categories: ['populated_place', 'populated_place.city'] } }] };
    default:
      return undefined;
  }
}

function requestUrl(input) {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function installFakeGeoapify(target = globalThis) {
  const realFetch = target.fetch;
  target.fetch = async function fakeGeoapifyFetch(input, init) {
    const url = requestUrl(input);
    if (url.hostname !== GEOAPIFY_HOST) return realFetch.call(this, input, init);
    const body = fakeGeoapifyBody(url);
    if (body === undefined) return new Response(JSON.stringify({ error: 'not stubbed' }), { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

module.exports = { fakeGeoapifyBody, installFakeGeoapify };

// Run by `node --require`; a plain require() from a test only gets the exports above.
if (process.env.E2E_FAKE_GEOAPIFY === '1') installFakeGeoapify();
