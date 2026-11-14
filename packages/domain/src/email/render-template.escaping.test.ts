import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailTemplate } from './render-template.js';
import { EMAIL_TEMPLATES } from './templates.js';
import type { EmailTemplateKey, EmailTemplateVariables } from './types.js';

// Story 0.i1a, Task 1.5 (FIND-021, render-template.ts has no HTML-escaping): a script-bearing payload through
// EVERY template. Variables are built from the placeholders each template contains, so a template added later
// is covered with no edit. Story 0.i1z (the ratchet) cites the two named cases below.
const SCRIPT_PAYLOAD = `<script>alert(1)</script>"'&`;
const ESCAPED_PAYLOAD = '&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;';
const SUBJECT_PAYLOAD = `${SCRIPT_PAYLOAD}\r\nBcc: x@example.com`;

function placeholdersOf(key: EmailTemplateKey): string[] {
  const t = EMAIL_TEMPLATES[key];
  const found = new Set<string>();
  for (const part of [t.subject, t.html, t.text]) {
    for (const m of part.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)) found.add(m[1]);
  }
  return [...found];
}

function varsFor(key: EmailTemplateKey, payload: string): EmailTemplateVariables[EmailTemplateKey] {
  return Object.fromEntries(placeholdersOf(key).map((name) => [name, payload])) as EmailTemplateVariables[EmailTemplateKey];
}

function assertEscaped(key: EmailTemplateKey) {
  const rendered = renderEmailTemplate(key, varsFor(key, SUBJECT_PAYLOAD));
  assert.ok(!/<script/i.test(rendered.html), `${key}: html has no <script`);
  assert.ok(rendered.html.includes(ESCAPED_PAYLOAD), `${key}: html has the escaped payload`);
  for (const m of rendered.html.matchAll(/href="([^"]*)"/g)) {
    assert.ok(!/["']/.test(m[1]), `${key}: no raw quote inside an href`);
  }
  assert.ok(!/[\r\n]/.test(rendered.subject), `${key}: subject has no CR or LF`);
  assert.ok(rendered.text.includes(SUBJECT_PAYLOAD), `${key}: text keeps the payload unchanged`);
}

test('every template escapes html, strips subject line breaks and leaves text unchanged (AC2)', () => {
  for (const key of Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[]) {
    assertEscaped(key);
  }
});

test('DANGEROUS_EVENT_MODERATOR_ALERT escapes a script-bearing event name (AC2)', () => {
  const r = renderEmailTemplate('DANGEROUS_EVENT_MODERATOR_ALERT', {
    eventName: SUBJECT_PAYLOAD,
    moderatorReviewUrl: 'https://festdaily.app/moderator/items',
  });
  assert.ok(!r.html.includes('<script'));
  assert.ok(r.html.includes(ESCAPED_PAYLOAD));
  assert.ok(!/[\r\n]/.test(r.subject));
  assert.ok(r.subject.includes('Bcc: x@example.com'));
  assert.ok(r.text.includes(SCRIPT_PAYLOAD));
});

test('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT escapes script-bearing source, message and context (AC2)', () => {
  const r = renderEmailTemplate('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT', {
    source: SUBJECT_PAYLOAD,
    message: SCRIPT_PAYLOAD,
    context: SCRIPT_PAYLOAD,
    moderatorReviewUrl: 'https://festdaily.app/moderator/items',
  });
  assert.ok(!r.html.includes('<script'));
  assert.ok(r.html.includes(ESCAPED_PAYLOAD));
  assert.ok(!/[\r\n]/.test(r.subject));
  assert.ok(r.text.includes(SCRIPT_PAYLOAD));
});

test('a value that looks like a placeholder or a replacement pattern is never re-expanded (AC2)', () => {
  const r = renderEmailTemplate('DANGEROUS_EVENT_MODERATOR_ALERT', {
    eventName: '{{moderatorReviewUrl}} $& $1',
    moderatorReviewUrl: 'https://festdaily.app/x',
  });
  assert.ok(r.html.includes('{{moderatorReviewUrl}} $&amp; $1'));
});

test('a number value is stringified before escaping (AC2)', () => {
  const r = renderEmailTemplate('SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT', {
    provider: 'p',
    consecutiveFailureDays: 3,
    moderatorReviewUrl: 'https://festdaily.app/moderator/tools',
    failureReasonSummary: 's',
  });
  assert.ok(r.html.includes('3'));
});

test('a very long value cannot make a subject longer than the cap (AC2)', () => {
  const r = renderEmailTemplate('DANGEROUS_EVENT_MODERATOR_ALERT', {
    eventName: 'x'.repeat(5000),
    moderatorReviewUrl: 'https://festdaily.app/moderator/items',
  });
  assert.equal(r.subject.length, 200);
  assert.ok(r.text.includes('x'.repeat(5000)), 'the text part is not capped');
});
