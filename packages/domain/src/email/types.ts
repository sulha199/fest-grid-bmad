export type EmailTemplateKey =
  | 'QUOTA_EXHAUSTION_WARNING'
  | 'INVALID_API_KEY_ALERT'
  | 'DANGEROUS_EVENT_MODERATOR_ALERT'
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
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
