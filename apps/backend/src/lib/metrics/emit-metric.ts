// IDEA-096: the ops alarms (apps/infrastructure `OpsAlerts`) need numbers CloudWatch can alarm on, and the
// only thing the app can do from inside a Lambda without a client, an IAM grant or a dependency is write a
// log line. A line in CloudWatch Embedded Metric Format (EMF) is turned into a metric by CloudWatch itself.
//
// The names below are the contract with `apps/infrastructure/lib/festgrid-backend-stack.ts`, which cannot
// import this package; its stack test pins the same strings.
export const OPS_METRICS_NAMESPACE = 'FestGrid/Backend';

export const OpsMetric = {
  /** One per newly inserted post, from any Lambda: the vendor-agnostic "is data arriving" signal. */
  PostsSaved: 'PostsSaved',
  /** A scraper provider entered the degraded state (the daily batch logged the transition). */
  ProviderDegraded: 'ProviderDegraded',
  /** A scraper provider left the degraded state. */
  ProviderRecovered: 'ProviderRecovered',
} as const;

export type OpsMetricName = (typeof OpsMetric)[keyof typeof OpsMetric];

/**
 * Writes one EMF line. `properties` are log fields only (searchable in Logs Insights), not metric
 * dimensions, so the metric stays a single series that one alarm can watch.
 *
 * Only writes inside a Lambda: an EMF line anywhere else is just noise in the test output. Never throws,
 * because a metric must not be able to fail the work it describes.
 */
export function emitOpsMetric(
  name: OpsMetricName,
  value = 1,
  properties: Record<string, string | number | boolean> = {}
): void {
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) return;
  try {
    console.log(
      JSON.stringify({
        ...properties,
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [
            {
              Namespace: OPS_METRICS_NAMESPACE,
              Dimensions: [[]],
              Metrics: [{ Name: name, Unit: 'Count' }],
            },
          ],
        },
        [name]: value,
      })
    );
  } catch (error) {
    console.error('[emitOpsMetric] Could not write the metric line:', error);
  }
}
