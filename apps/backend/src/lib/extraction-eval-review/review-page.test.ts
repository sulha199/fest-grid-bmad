import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { test } from 'node:test';
import { PAGE_SCRIPT, PAGE_STYLE, renderReviewPage } from './review-page.js';

test('the page script is valid JavaScript', () => {
  assert.doesNotThrow(() => new Script(PAGE_SCRIPT));
});

test('the page is self-contained: no external address, no inline event handler attribute, no HTML built from strings', () => {
  const html = renderReviewPage();
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<link |<img |<iframe|<script src|@import|url\(/);
  assert.doesNotMatch(PAGE_SCRIPT, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage/);
  // the style is applied from the sheet only: setting a style attribute would need an unsafe CSP
  assert.doesNotMatch(PAGE_SCRIPT, /style:|\.style\b|setAttribute\('style/);
  assert.ok(PAGE_STYLE.length > 100);
});

test('the page only calls its own api and image routes, with relative addresses', () => {
  assert.match(PAGE_SCRIPT, /fetch\('api\/' \+ path/);
  assert.match(PAGE_SCRIPT, /'img\/' \+ enc\(id\)/);
  assert.doesNotMatch(PAGE_SCRIPT, /fetch\('\//);
});

test('leaving a post never drops unsaved typing: Skip and Flag save first, and a navigation asks before discarding', () => {
  assert.match(PAGE_SCRIPT, /var saving = dirty \? save\(\) : Promise\.resolve\(\)/);
  assert.match(PAGE_SCRIPT, /Leave without saving them\?/);
  assert.match(PAGE_SCRIPT, /window\.addEventListener\('hashchange', onHashChange\)/);
  // an older response must not draw over a newer navigation, and a bad address must not throw
  assert.match(PAGE_SCRIPT, /if \(mine !== navId\) return;/);
  assert.match(PAGE_SCRIPT, /try \{ id = decodeURIComponent/);
});

test('the page shows the three things the brief asks for: filters on flags, images beside the form, and the verify action', () => {
  for (const text of ['Open the first pending post', 'Verify and upload', 'Save edits', 'Reset to the draft', 'Skip', 'Flag for later', 'Add a schedule', 'Add an event', 'Remove event', 'Remove schedule', 'Caption (as production saw it)']) {
    assert.ok(PAGE_SCRIPT.includes(text), text);
  }
  assert.match(PAGE_STYLE, /\.cols \{ display: grid/);
});
