import test from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_TEMPLATES } from './templates.js';
import {
  MODERATOR_NOTIFICATION_ENTITY_KEYS,
  MODERATOR_REVIEW_PATHS,
  MODERATOR_TEMPLATE_KEYS,
  buildModeratorReviewUrl,
} from './moderator-notification.js';
import type { EmailTemplateKey } from './types.js';

test('buildModeratorReviewUrl equals the old base + path for a base without a trailing slash (AC1)', () => {
  assert.equal(buildModeratorReviewUrl('https://festdaily.app', '/moderator/items'), 'https://festdaily.app/moderator/items');
});

test('buildModeratorReviewUrl never produces a double slash (AC1)', () => {
  assert.equal(buildModeratorReviewUrl('https://festdaily.app/', '/moderator/tools'), 'https://festdaily.app/moderator/tools');
  assert.equal(buildModeratorReviewUrl('https://festdaily.app//', 'moderator/tools'), 'https://festdaily.app/moderator/tools');
});

test('every template that links to the moderator review page is a moderator template, and every member has a path and an entity rule (AC1)', () => {
  const linking = (Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[]).filter((key) =>
    EMAIL_TEMPLATES[key].text.includes('{{moderatorReviewUrl}}')
  );
  assert.deepEqual([...linking].sort(), [...MODERATOR_TEMPLATE_KEYS].sort());
  for (const key of MODERATOR_TEMPLATE_KEYS) {
    assert.ok(MODERATOR_REVIEW_PATHS[key].startsWith('/'), `${key} has a review path`);
    assert.equal(typeof MODERATOR_NOTIFICATION_ENTITY_KEYS[key], 'function', `${key} has an entity rule`);
  }
  assert.ok(!(MODERATOR_TEMPLATE_KEYS as readonly string[]).includes('SYSTEM_ERROR_ALERT'));
});

test('provider-down links to the tools page, the job notice to the Jobs page and the other four to the items page (AC1)', () => {
  assert.equal(MODERATOR_REVIEW_PATHS.SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT, '/moderator/tools');
  assert.equal(MODERATOR_REVIEW_PATHS.JOB_FINISHED_MODERATOR_NOTICE, '/jobs');
  assert.equal(MODERATOR_NOTIFICATION_ENTITY_KEYS.JOB_FINISHED_MODERATOR_NOTICE({ jobId: 'job-1', summaryEn: 'a', summaryId: 'b' }), 'job-1');
  for (const key of MODERATOR_TEMPLATE_KEYS.filter((k) => k !== 'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT' && k !== 'JOB_FINISHED_MODERATOR_NOTICE')) {
    assert.equal(MODERATOR_REVIEW_PATHS[key], '/moderator/items');
  }
});

test('default entity rules pick the stable field of each template, never message or context (AC3)', () => {
  const keys = MODERATOR_NOTIFICATION_ENTITY_KEYS;
  assert.equal(keys.DANGEROUS_EVENT_MODERATOR_ALERT({ eventName: 'E' }), 'E');
  assert.equal(
    keys.SCRAPER_AUDIT_TRAIL_FAILURE_ALERT({ source: 'recordActorRunStart', message: 'm1', context: 'c1' }),
    'recordActorRunStart'
  );
  assert.equal(
    keys.SCRAPER_AUDIT_TRAIL_FAILURE_ALERT({ source: 'recordActorRunStart', message: 'm2', context: 'c2' }),
    'recordActorRunStart'
  );
  assert.equal(
    keys.SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT({ provider: 'apify', consecutiveFailureDays: 3, failureReasonSummary: 's' }),
    'apify'
  );
  const location = { accountDisplayName: 'Acct', previousLocationText: 'a', newLocationText: 'b' };
  assert.equal(keys.DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT(location), 'Acct');
  assert.equal(keys.DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT({ ...location, confidenceScorePercent: '80' }), 'Acct');
});
