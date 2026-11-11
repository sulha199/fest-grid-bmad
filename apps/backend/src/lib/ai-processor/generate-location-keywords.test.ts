import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeminiEventPayload } from '@festgrid/domain';
import {
  generateLocationKeywords,
  locationStringKey,
  MAX_LOCATION_STRINGS_PER_CALL,
  type LocationKeywordsCall,
} from './generate-location-keywords.js';

function event(overrides: Partial<GeminiEventPayload> = {}): GeminiEventPayload {
  return {
    eventName: 'Pasar Rakyat Sleman',
    types: ['festival'],
    categories: ['OTHER'],
    confidenceScore: 0.9,
    location: 'Kabupaten Sleman',
    schedules: [
      { isMainSchedule: true, eventStartDate: '2026-11-02', location: 'Pasar Porosjayan, Gamping' },
      { isMainSchedule: false, eventStartDate: '2026-11-09', location: 'Pasar Porosjayan, Gamping' },
      { isMainSchedule: false, eventStartDate: '2026-11-16', location: 'Kalurahan Caturtunggal' },
      { isMainSchedule: false, eventStartDate: '2026-11-23' },
    ],
    ...overrides,
  } as GeminiEventPayload;
}

interface Recorded {
  requests: Array<{ contents: string; systemInstruction?: string; subscriberUserIds: string[] }>;
}

function fakeCall(answer: (lines: Array<{ id: string; location: string }>) => unknown, recorded: Recorded): LocationKeywordsCall {
  return async (request) => {
    recorded.requests.push({
      contents: request.contents as string,
      systemInstruction: request.systemInstruction,
      subscriberUserIds: request.subscriberUserIds,
    });
    const lines = (request.contents as string).split('\n').map((line) => JSON.parse(line));
    return { text: JSON.stringify(answer(lines)) };
  };
}

const quiet = () => {
  const original = { info: console.info, warn: console.warn };
  console.info = () => undefined;
  console.warn = () => undefined;
  return () => {
    console.info = original.info;
    console.warn = original.warn;
  };
};

test('locationStringKey ignores case, spacing and accents composition', () => {
  assert.equal(locationStringKey('  Pasar  Porosjayan '), locationStringKey('pasar porosjayan'));
});

test('one batched call covers every distinct location text, and the answers land on every row that shares the text', async () => {
  const restore = quiet();
  try {
    const recorded: Recorded = { requests: [] };
    const events = [event()];
    await generateLocationKeywords(events, {
      callGemini: fakeCall(
        (lines) =>
          lines.map((line) =>
            line.location === 'Kabupaten Sleman'
              ? { id: line.id, locationKeywords: ['Sleman'], countryCode: 'id' }
              : line.location.startsWith('Pasar')
                ? { id: line.id, locationKeywords: ['Pasar Porosjayan', 'Gamping', 'Sleman'], countryCode: 'ID' }
                : { id: line.id, locationKeywords: ['Kalurahan Caturtunggal', 'Depok', 'Sleman', 'Berbagai lokasi'], countryCode: null }
          ),
        recorded
      ),
      subscriberUserIds: ['u1'],
      sourceText: 'Pasar rakyat #sleman #jogja #sleman',
    });

    assert.equal(recorded.requests.length, 1);
    assert.deepEqual(recorded.requests[0].subscriberUserIds, ['u1']);
    const sent = recorded.requests[0].contents.split('\n').map((line) => JSON.parse(line));
    assert.equal(sent.length, 3, 'event location + 2 distinct schedule locations; the repeated one and the empty one are not sent');
    assert.deepEqual(sent[0].hashtags, ['#sleman', '#jogja']);
    assert.equal(sent[1].eventArea, 'Kabupaten Sleman');
    assert.equal(sent[0].eventArea, null, 'the event location is its own area, not context for itself');

    assert.deepEqual(events[0].locationKeywords, ['Sleman']);
    assert.equal(events[0].locationCountryCode, 'ID');
    assert.deepEqual(events[0].schedules[0].locationKeywords, ['Pasar Porosjayan', 'Gamping', 'Sleman']);
    assert.deepEqual(events[0].schedules[1].locationKeywords, ['Pasar Porosjayan', 'Gamping', 'Sleman']);
    assert.deepEqual(events[0].schedules[2].locationKeywords, ['Kalurahan Caturtunggal', 'Depok', 'Sleman'], 'generic phrase dropped');
    assert.equal(events[0].schedules[2].locationCountryCode, 'ID', 'no code of its own: it joins the two coded strings that agree');
    assert.equal(events[0].schedules[3].locationKeywords, undefined, 'a schedule without a location gets nothing');
  } finally {
    restore();
  }
});

test('a foreign place keeps its own country code', async () => {
  const restore = quiet();
  try {
    const events = [event({ location: 'Doylestown, PA 18901, United States', schedules: [{ isMainSchedule: true, eventStartDate: '2026-11-02' }] })];
    await generateLocationKeywords(events, {
      callGemini: fakeCall((lines) => lines.map((line) => ({ id: line.id, locationKeywords: ['Doylestown', 'Pennsylvania'], countryCode: 'us' })), { requests: [] }),
      subscriberUserIds: [],
    });
    assert.equal(events[0].locationCountryCode, 'US');
  } finally {
    restore();
  }
});

test('a failing call leaves everything untouched and never throws', async () => {
  const restore = quiet();
  try {
    const events = [event()];
    await assert.doesNotReject(
      generateLocationKeywords(events, {
        callGemini: async () => {
          throw new Error('503 busy');
        },
        subscriberUserIds: [],
      })
    );
    assert.equal(events[0].locationKeywords, undefined);
    assert.equal(events[0].schedules[0].locationKeywords, undefined);
  } finally {
    restore();
  }
});

test('a call that outlives its timeout is given up on', async () => {
  const restore = quiet();
  try {
    const events = [event()];
    const started = Date.now();
    await generateLocationKeywords(events, {
      callGemini: () => new Promise(() => undefined),
      subscriberUserIds: [],
      timeoutMs: 30,
    });
    assert.ok(Date.now() - started < 2000);
    assert.equal(events[0].locationKeywords, undefined);
  } finally {
    restore();
  }
});

test('unusable answers (not JSON, not an array, unknown ids, duplicates) change nothing or only what is valid', async () => {
  const restore = quiet();
  try {
    for (const text of ['not json', '{"a":1}', '[]', '[{"id":"zzz","locationKeywords":["X"]},null,3]']) {
      const events = [event()];
      await generateLocationKeywords(events, { callGemini: async () => ({ text }), subscriberUserIds: [] });
      assert.equal(events[0].locationKeywords, undefined, text);
    }
    const events = [event()];
    await generateLocationKeywords(events, {
      callGemini: async () => ({
        text: JSON.stringify([
          { id: 's0', locationKeywords: ['Sleman'] },
          { id: 's0', locationKeywords: ['Other'] },
        ]),
      }),
      subscriberUserIds: [],
    });
    assert.deepEqual(events[0].locationKeywords, ['Sleman'], 'the first answer for an id wins');
    assert.equal(events[0].schedules[0].locationKeywords, undefined, 'partial: the other ids stay empty');
  } finally {
    restore();
  }
});

test('no locations means no call; a model-supplied value is not overwritten', async () => {
  const restore = quiet();
  try {
    const recorded: Recorded = { requests: [] };
    await generateLocationKeywords([event({ location: undefined, schedules: [{ isMainSchedule: true, eventStartDate: '2026-11-02' }] })], {
      callGemini: fakeCall(() => [], recorded),
      subscriberUserIds: [],
    });
    assert.equal(recorded.requests.length, 0);

    const events = [event({ locationKeywords: ['Already'] })];
    await generateLocationKeywords(events, {
      callGemini: fakeCall((lines) => lines.map((line) => ({ id: line.id, locationKeywords: ['Sleman'] })), recorded),
      subscriberUserIds: [],
    });
    assert.deepEqual(events[0].locationKeywords, ['Already']);
  } finally {
    restore();
  }
});

test('more distinct texts than the cap are not all sent', async () => {
  const restore = quiet();
  try {
    const recorded: Recorded = { requests: [] };
    const many = event({
      schedules: Array.from({ length: MAX_LOCATION_STRINGS_PER_CALL + 5 }, (_, i) => ({
        isMainSchedule: i === 0,
        eventStartDate: '2026-11-02',
        location: `Tempat ${i}`,
      })),
    });
    await generateLocationKeywords([many], {
      callGemini: fakeCall((lines) => lines.map((line) => ({ id: line.id, locationKeywords: ['Sleman'] })), recorded),
      subscriberUserIds: [],
    });
    assert.equal(recorded.requests[0].contents.split('\n').length, MAX_LOCATION_STRINGS_PER_CALL);
  } finally {
    restore();
  }
});

test('the request asks for countryCode and never mentions an account region', async () => {
  const restore = quiet();
  try {
    const recorded: Recorded = { requests: [] };
    await generateLocationKeywords([event()], { callGemini: fakeCall(() => [], recorded), subscriberUserIds: [] });
    assert.ok(recorded.requests[0].systemInstruction?.includes('countryCode'));
    assert.ok(!/authorRegion|default location/i.test(recorded.requests[0].systemInstruction ?? ''));
    assert.ok(!recorded.requests[0].contents.includes('authorRegion'));
  } finally {
    restore();
  }
});

test('the prompt names the configured home country, and no country at all when none is configured', async () => {
  const restore = quiet();
  try {
    for (const [configured, expected] of [['PH', 'code "PH"'], [null, null]] as const) {
      const recorded: Recorded = { requests: [] };
      await generateLocationKeywords([event()], {
        callGemini: fakeCall(() => [], recorded),
        subscriberUserIds: [],
        defaultCountryCode: configured,
      });
      const prompt = recorded.requests[0].systemInstruction ?? '';
      if (expected) assert.ok(prompt.includes(expected));
      else assert.ok(!/Most places are in/.test(prompt));
      assert.ok(!prompt.includes('Indonesia') && !prompt.includes('"ID"'), 'no country is hard-coded');
    }
  } finally {
    restore();
  }
});

test('a text without a code takes the country most of the call strings share, but only with at least two coded strings', async () => {
  const restore = quiet();
  try {
    const answerFor = (codes: Record<string, string | null>) => (lines: Array<{ id: string; location: string }>) =>
      lines.map((line) => ({ id: line.id, locationKeywords: [line.location], countryCode: codes[line.location] ?? null }));

    const agreeing = [event()];
    await generateLocationKeywords(agreeing, {
      callGemini: fakeCall(answerFor({ 'Kabupaten Sleman': 'SG', 'Pasar Porosjayan, Gamping': 'SG' }), { requests: [] }),
      subscriberUserIds: [],
    });
    assert.equal(agreeing[0].schedules[2].locationCountryCode, 'SG', 'Kalurahan Caturtunggal had no code and joins the two that agree');

    const split = [event()];
    await generateLocationKeywords(split, {
      callGemini: fakeCall(answerFor({ 'Kabupaten Sleman': 'ID', 'Pasar Porosjayan, Gamping': 'SG' }), { requests: [] }),
      subscriberUserIds: [],
    });
    assert.equal(split[0].schedules[2].locationCountryCode, undefined, 'no majority, no guess');

    const single = [event()];
    await generateLocationKeywords(single, {
      callGemini: fakeCall(answerFor({ 'Kabupaten Sleman': 'ID' }), { requests: [] }),
      subscriberUserIds: [],
    });
    assert.equal(single[0].schedules[2].locationCountryCode, undefined, 'one coded string is not a consensus');
  } finally {
    restore();
  }
});

test('a null or empty value already on a row counts as not set; every row gets its own copy of the list', async () => {
  const restore = quiet();
  try {
    const events = [event({ locationKeywords: null as unknown as string[] })];
    events[0].schedules[0].locationKeywords = [];
    await generateLocationKeywords(events, {
      callGemini: fakeCall((lines) => lines.map((line) => ({ id: line.id, locationKeywords: ['Sleman', 'Yogyakarta'], countryCode: 'ID' })), { requests: [] }),
      subscriberUserIds: [],
    });
    assert.deepEqual(events[0].locationKeywords, ['Sleman', 'Yogyakarta']);
    assert.deepEqual(events[0].schedules[0].locationKeywords, ['Sleman', 'Yogyakarta']);
    assert.notStrictEqual(events[0].schedules[0].locationKeywords, events[0].schedules[1].locationKeywords, 'no shared array between rows');
  } finally {
    restore();
  }
});

