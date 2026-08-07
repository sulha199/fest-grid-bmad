import { EmailTemplateKey } from './types.js';

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, { subject: string; html: string; text: string }> = {
  QUOTA_EXHAUSTION_WARNING: {
    subject: 'Action Required: Your FestDaily event extraction is paused',
    html: `<p>Hello {{userName}},</p>
<p>Your FestDaily event extraction is paused because your API key quota has been exhausted. Currently, <strong>{{queuedPostCount}}</strong> of your subscribed posts have been queued for <strong>{{queuedDays}}</strong> days.</p>
<p>To resume processing, please contribute an additional API key via: <a href="{{apiKeyManagementUrl}}">{{apiKeyManagementUrl}}</a></p>`,
    text: `Hello {{userName}},

Your FestDaily event extraction is paused because your API key quota has been exhausted. Currently, {{queuedPostCount}} of your subscribed posts have been queued for {{queuedDays}} days.

To resume processing, please contribute an additional API key via: {{apiKeyManagementUrl}}`,
  },
  INVALID_API_KEY_ALERT: {
    subject: 'Action Required: One of your FestDaily API keys is no longer working',
    html: `<p>Hello {{userName}},</p>
<p>One of your FestDaily API keys is no longer working. We detected <strong>{{invalidAttemptCount}}</strong> consecutive failed extraction attempts using this key. As a result, shared-subscription push notifications relying on this key have been paused.</p>
<p>Please review or replace your API key via: <a href="{{apiKeyManagementUrl}}">{{apiKeyManagementUrl}}</a></p>`,
    text: `Hello {{userName}},

One of your FestDaily API keys is no longer working. We detected {{invalidAttemptCount}} consecutive failed extraction attempts using this key. As a result, shared-subscription push notifications relying on this key have been paused.

Please review or replace your API key via: {{apiKeyManagementUrl}}`,
  },
  DANGEROUS_EVENT_MODERATOR_ALERT: {
    subject: '[FestDaily Moderation] Dangerous event reported: {{eventName}}',
    html: `<p>A user has reported the event "<strong>{{eventName}}</strong>" as dangerous.</p>
<p>Please review this item and take appropriate action on the Moderator Items page: <a href="{{moderatorReviewUrl}}">{{moderatorReviewUrl}}</a></p>`,
    text: `A user has reported the event "{{eventName}}" as dangerous.

Please review this item and take appropriate action on the Moderator Items page: {{moderatorReviewUrl}}`,
  },
};
