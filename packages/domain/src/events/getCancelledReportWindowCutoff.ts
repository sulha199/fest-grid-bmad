export interface GetCancelledReportWindowCutoffInput {
  windowDays: number;
  now?: Date;
}

export function getCancelledReportWindowCutoff({
  windowDays,
  now = new Date(),
}: GetCancelledReportWindowCutoffInput): Date {
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const utcMilliseconds = now.getUTCMilliseconds();

  const cutoff = new Date(Date.UTC(utcYear, utcMonth, utcDate, utcHours, utcMinutes, utcSeconds, utcMilliseconds));
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  return cutoff;
}
