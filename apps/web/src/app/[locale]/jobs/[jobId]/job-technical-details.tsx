'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { JobFormatters } from '@festgrid/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { reasonText, type JobTranslator } from '@/features/jobs/job-copy';
import type { JobDetailRaw } from '@/features/jobs/use-job-detail';

export interface JobTechnicalDetailsProps {
  job: Pick<JobDetailRaw, 'id' | 'trigger' | 'owner' | 'moderatorDetails'>;
  format: JobFormatters;
  tr: JobTranslator;
}

/**
 * Story 10.4 Part C -- "Technical details (moderators)": the provider attempts, the engine's own reason code and plain message, the job id and who
 * started it. Rendered only when the server sent `moderatorDetails` (a moderator); an ordinary user's response has none, so there is nothing to
 * hide client-side. Collapsed by default. A `Table` from `md:` up (inside an `overflow-x-auto` box), a stacked definition list below.
 */
export function JobTechnicalDetails({ job, format, tr }: JobTechnicalDetailsProps) {
  const t = useTranslations('Jobs');
  const details = job.moderatorDetails;
  if (!details) return null;

  const providerLabel = (provider: string) => (tr.has(`moderator.provider.${provider}`) ? tr(`moderator.provider.${provider}`) : provider);
  const outcomeLabel = (outcome: string) => (tr.has(`moderator.outcome.${outcome}`) ? tr(`moderator.outcome.${outcome}`) : outcome);
  const attemptReason = (code: string | null | undefined) => (code ? reasonText(tr, code, {}) : '-');
  const trigger = job.trigger === 'SYSTEM' ? t('moderator.triggerSystem') : job.owner?.displayName ? `${t('moderator.triggerUser')}: ${job.owner.displayName}` : t('moderator.triggerUser');

  const rows: Array<[string, string]> = [
    [t('moderator.engineReason'), details.engineReasonCode ?? '-'],
    [t('moderator.engineMessage'), details.engineMessage ?? '-'],
    [t('moderator.jobId'), job.id],
    [t('moderator.trigger'), trigger],
  ];

  return (
    <details className="min-w-0 rounded-xl border border-border p-4" data-testid="job-technical-details">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">{t('moderator.detailsSummary')}</summary>
      <div className="mt-3 min-w-0 space-y-4">
        <section className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold">{t('moderator.attemptsHeading')}</h3>
          {details.attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('moderator.noAttempts')}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block" data-testid="job-attempts-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('moderator.attemptProvider')}</TableHead>
                      <TableHead>{t('moderator.attemptOutcome')}</TableHead>
                      <TableHead>{t('moderator.attemptBudget')}</TableHead>
                      <TableHead>{t('moderator.attemptElapsed')}</TableHead>
                      <TableHead>{t('moderator.attemptReason')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.attempts.map((attempt, index) => (
                      <TableRow key={index}>
                        <TableCell>{providerLabel(attempt.provider)}</TableCell>
                        <TableCell>{outcomeLabel(attempt.outcome)}</TableCell>
                        <TableCell>{format.duration(attempt.budgetMs)}</TableCell>
                        <TableCell>{format.duration(attempt.elapsedMs)}</TableCell>
                        <TableCell>{attemptReason(attempt.reasonCode)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="space-y-3 md:hidden" data-testid="job-attempts-list">
                {details.attempts.map((attempt, index) => (
                  <li key={index} className="min-w-0 rounded-md border border-border p-3">
                    <dl className="grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">{t('moderator.attemptProvider')}</dt>
                      <dd className="break-words">{providerLabel(attempt.provider)}</dd>
                      <dt className="text-muted-foreground">{t('moderator.attemptOutcome')}</dt>
                      <dd className="break-words">{outcomeLabel(attempt.outcome)}</dd>
                      <dt className="text-muted-foreground">{t('moderator.attemptBudget')}</dt>
                      <dd className="break-words">{format.duration(attempt.budgetMs)}</dd>
                      <dt className="text-muted-foreground">{t('moderator.attemptElapsed')}</dt>
                      <dd className="break-words">{format.duration(attempt.elapsedMs)}</dd>
                      <dt className="text-muted-foreground">{t('moderator.attemptReason')}</dt>
                      <dd className="break-words">{attemptReason(attempt.reasonCode)}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </details>
  );
}
