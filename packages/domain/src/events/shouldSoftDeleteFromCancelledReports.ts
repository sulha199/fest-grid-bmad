export interface ShouldSoftDeleteFromCancelledReportsInput {
  uniqueReporterCount: number;
  threshold: number;
}

export function shouldSoftDeleteFromCancelledReports({
  uniqueReporterCount,
  threshold,
}: ShouldSoftDeleteFromCancelledReportsInput): boolean {
  return uniqueReporterCount >= threshold;
}
