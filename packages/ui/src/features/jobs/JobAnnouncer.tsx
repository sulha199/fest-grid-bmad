import React from 'react';
import type { JobAnnouncerMessage } from './useJobAnnouncements';

/**
 * One per page: a visually hidden polite, atomic status region, plus an empty alert region used only for a
 * failure in a dialog the user is watching. Chip, row and badge carry text of their own; this is only the
 * spoken channel.
 */
export function JobAnnouncer({ message }: { message: JobAnnouncerMessage | null }) {
  const polite = message?.role === 'status' ? message : null;
  const alert = message?.role === 'alert' ? message : null;
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="job-announcer">
        {polite ? <span key={polite.seq}>{polite.text}</span> : null}
      </div>
      <div role="alert" aria-atomic="true" className="sr-only" data-testid="job-announcer-alert">
        {alert ? <span key={alert.seq}>{alert.text}</span> : null}
      </div>
    </>
  );
}
