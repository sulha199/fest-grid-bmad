import { capturePostHogEvent } from '@festgrid/analytics';

/**
 * Story 10.4 Part B -- the four job events of the spec, nothing more. snake_case names, camelCase properties, and never a
 * handle, URL, caption or vendor name. No event on polling or on render.
 */
export function trackJobProgressMinimized(props: { jobType: string; status: string }): void {
  capturePostHogEvent('job_progress_minimized', { jobType: props.jobType, status: props.status });
}

export function trackJobProgressReopened(props: { jobType: string; status: string; source: 'chip' | 'jobs_page' }): void {
  capturePostHogEvent('job_progress_reopened', { jobType: props.jobType, status: props.status, source: props.source });
}

export function trackJobRetryClicked(props: { jobType: string; reasonCode: string | null }): void {
  capturePostHogEvent('job_retry_clicked', { jobType: props.jobType, reasonCode: props.reasonCode });
}

export function trackJobsFilterChanged(props: { scope: string; includeSystem: boolean }): void {
  capturePostHogEvent('jobs_filter_changed', { scope: props.scope, includeSystem: props.includeSystem });
}
