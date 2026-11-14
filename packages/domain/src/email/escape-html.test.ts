import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SUBJECT_LENGTH, capSubject, escapeHtml, sanitizeSubjectValue } from './escape-html.js';

test('escapeHtml replaces the five HTML-significant characters, ampersand first (AC2)', () => {
  assert.equal(escapeHtml(`<script>alert(1)</script>"'&`), '&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  assert.equal(escapeHtml('plain text 123'), 'plain text 123');
  assert.equal(escapeHtml(''), '');
});

test('sanitizeSubjectValue collapses control-character runs to one space and trims (AC2)', () => {
  assert.equal(sanitizeSubjectValue('hello\r\nBcc: x@example.com'), 'hello Bcc: x@example.com');
  assert.equal(sanitizeSubjectValue('a\n\n\r\tb'), 'a b');
  assert.equal(sanitizeSubjectValue('\r\n  padded \n'), 'padded');
  assert.equal(sanitizeSubjectValue(`a${String.fromCharCode(0x2028)}b`), 'a b');
  assert.equal(sanitizeSubjectValue('no change'), 'no change');
  assert.equal(sanitizeSubjectValue('<b> & stays</b>'), '<b> & stays</b>');
});

test('capSubject leaves a short subject alone and cuts a long one to the cap with an ellipsis (AC2)', () => {
  assert.equal(capSubject('short'), 'short');
  const atCap = 'a'.repeat(MAX_SUBJECT_LENGTH);
  assert.equal(capSubject(atCap), atCap);
  const cut = capSubject('b'.repeat(MAX_SUBJECT_LENGTH + 50));
  assert.equal(cut.length, MAX_SUBJECT_LENGTH);
  assert.ok(cut.endsWith(String.fromCharCode(0x2026)));
  // trailing spaces before the cut are dropped, so the ellipsis follows a word
  const spaced = capSubject(`${'c'.repeat(MAX_SUBJECT_LENGTH - 3)}   ${'d'.repeat(20)}`);
  assert.equal(spaced, `${'c'.repeat(MAX_SUBJECT_LENGTH - 3)}${String.fromCharCode(0x2026)}`);
});
