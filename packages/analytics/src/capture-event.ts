import posthog from 'posthog-js';

export function capturePostHogEvent(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }
  posthog.capture(event, properties);
}
