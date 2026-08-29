export type EmailTemplateKey =
  | 'QUOTA_EXHAUSTION_WARNING'
  | 'INVALID_API_KEY_ALERT'
  | 'DANGEROUS_EVENT_MODERATOR_ALERT'
  | 'DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT'
  | 'DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT'
  | 'SYSTEM_ERROR_ALERT';

export interface EmailTemplateVariables {
  QUOTA_EXHAUSTION_WARNING: {
    userName: string;
    queuedPostCount: number;
    queuedDays: number;
    apiKeyManagementUrl: string;
  };
  INVALID_API_KEY_ALERT: {
    userName: string;
    invalidAttemptCount: number;
    apiKeyManagementUrl: string;
  };
  DANGEROUS_EVENT_MODERATOR_ALERT: {
    eventName: string;
    moderatorReviewUrl: string;
  };
  SYSTEM_ERROR_ALERT: {
    source: string;
    message: string;
    context: string;
    timestamp: string;
  };
  DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT: {
    accountDisplayName: string;
    previousLocationText: string;
    newLocationText: string;
    confidenceScorePercent: string;
    moderatorReviewUrl: string;
  };
  DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT: {
    accountDisplayName: string;
    previousLocationText: string;
    newLocationText: string;
    moderatorReviewUrl: string;
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
