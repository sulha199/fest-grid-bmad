import test from 'node:test';
import assert from 'node:assert';
import { emitOpsMetric, OpsMetric, OPS_METRICS_NAMESPACE } from './emit-metric.js';

async function captureLogs(fn: () => void): Promise<string[]> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

test('emitOpsMetric', async (t) => {
  const originalFunctionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  t.after(() => {
    if (originalFunctionName === undefined) {
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    } else {
      process.env.AWS_LAMBDA_FUNCTION_NAME = originalFunctionName;
    }
  });

  await t.test('writes nothing outside a Lambda', async () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    assert.deepStrictEqual(await captureLogs(() => emitOpsMetric(OpsMetric.PostsSaved)), []);
  });

  await t.test('writes one EMF line with an undimensioned count metric inside a Lambda', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'ScraperLambda-prod';

    const lines = await captureLogs(() => emitOpsMetric(OpsMetric.PostsSaved));

    assert.strictEqual(lines.length, 1);
    const line = JSON.parse(lines[0]);
    assert.strictEqual(line.PostsSaved, 1);
    assert.ok(typeof line._aws.Timestamp === 'number');
    assert.deepStrictEqual(line._aws.CloudWatchMetrics, [
      { Namespace: OPS_METRICS_NAMESPACE, Dimensions: [[]], Metrics: [{ Name: 'PostsSaved', Unit: 'Count' }] },
    ]);
  });

  await t.test('keeps properties as log fields, not dimensions', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'ScraperLambda-prod';

    const lines = await captureLogs(() => emitOpsMetric(OpsMetric.ProviderDegraded, 1, { Provider: 'BRIGHTDATA' }));

    const line = JSON.parse(lines[0]);
    assert.strictEqual(line.Provider, 'BRIGHTDATA');
    assert.strictEqual(line.ProviderDegraded, 1);
    assert.deepStrictEqual(line._aws.CloudWatchMetrics[0].Dimensions, [[]]);
  });

  await t.test('pins the metric names the infrastructure stack alarms on', () => {
    assert.deepStrictEqual(OpsMetric, {
      PostsSaved: 'PostsSaved',
      ProviderDegraded: 'ProviderDegraded',
      ProviderRecovered: 'ProviderRecovered',
    });
    assert.strictEqual(OPS_METRICS_NAMESPACE, 'FestGrid/Backend');
  });

  await t.test('never throws when the line cannot be written', () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'ScraperLambda-prod';
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    assert.doesNotThrow(() => emitOpsMetric(OpsMetric.PostsSaved, 1, circular as never));
  });
});
