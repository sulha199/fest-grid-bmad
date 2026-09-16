import { test } from 'node:test';
import assert from 'node:assert';
import { sanitizeEventLinks } from './sanitize-event-links.js';
import { EventLink } from '@festgrid/shared-types';

test('sanitizeEventLinks - keeps valid http/https entries', () => {
  const links: EventLink[] = [
    { url: 'https://example.com/tickets', label: 'Tickets' },
    { url: 'http://example.com/rsvp' },
  ];

  const result = sanitizeEventLinks(links);

  assert.deepStrictEqual(result, [
    { url: 'https://example.com/tickets', label: 'Tickets' },
    { url: 'http://example.com/rsvp' },
  ]);
});

test('sanitizeEventLinks - drops javascript: URLs', () => {
  const result = sanitizeEventLinks([{ url: 'javascript:alert(1)' }]);
  assert.strictEqual(result, undefined);
});

test('sanitizeEventLinks - drops data: URLs', () => {
  const result = sanitizeEventLinks([{ url: 'data:text/html,<script>alert(1)</script>' }]);
  assert.strictEqual(result, undefined);
});

test('sanitizeEventLinks - drops malformed/unparseable URLs', () => {
  const result = sanitizeEventLinks([{ url: 'not a url' }]);
  assert.strictEqual(result, undefined);
});

test('sanitizeEventLinks - drops relative/protocol-relative URLs (no absolute http(s) protocol)', () => {
  const result = sanitizeEventLinks([{ url: '/relative/path' }, { url: '//example.com/foo' }]);
  assert.strictEqual(result, undefined);
});

test('sanitizeEventLinks - trims label whitespace', () => {
  const result = sanitizeEventLinks([{ url: 'https://example.com', label: '  Tickets  ' }]);
  assert.deepStrictEqual(result, [{ url: 'https://example.com', label: 'Tickets' }]);
});

test('sanitizeEventLinks - treats whitespace-only label as absent', () => {
  const result = sanitizeEventLinks([{ url: 'https://example.com', label: '   ' }]);
  assert.deepStrictEqual(result, [{ url: 'https://example.com' }]);
});

test('sanitizeEventLinks - treats empty-string label as absent', () => {
  const result = sanitizeEventLinks([{ url: 'https://example.com', label: '' }]);
  assert.deepStrictEqual(result, [{ url: 'https://example.com' }]);
});

test('sanitizeEventLinks - caps result at first 10 valid entries in source order', () => {
  const links: EventLink[] = Array.from({ length: 15 }, (_, i) => ({
    url: `https://example.com/${i}`,
  }));

  const result = sanitizeEventLinks(links);

  assert.strictEqual(result?.length, 10);
  assert.deepStrictEqual(
    result?.map((l) => l.url),
    links.slice(0, 10).map((l) => l.url)
  );
});

test('sanitizeEventLinks - cap counts only valid entries, skipping invalid ones before counting toward 10', () => {
  const links: EventLink[] = [
    { url: 'javascript:bad()' }, // dropped, not counted
    ...Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/${i}` })),
    { url: 'https://example.com/overflow' }, // 11th valid entry, must be capped out
  ];

  const result = sanitizeEventLinks(links);

  assert.strictEqual(result?.length, 10);
  assert.deepStrictEqual(
    result?.map((l) => l.url),
    Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`)
  );
});

test('sanitizeEventLinks - returns undefined (not []) when input is undefined', () => {
  assert.strictEqual(sanitizeEventLinks(undefined), undefined);
});

test('sanitizeEventLinks - returns undefined (not []) when input is an empty array', () => {
  assert.strictEqual(sanitizeEventLinks([]), undefined);
});

test('sanitizeEventLinks - returns undefined (not []) when no valid entries remain after filtering', () => {
  const result = sanitizeEventLinks([{ url: 'javascript:x' }, { url: 'not a url' }]);
  assert.strictEqual(result, undefined);
});
