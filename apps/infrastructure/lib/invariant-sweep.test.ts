import { test } from 'node:test';
import assert from 'node:assert';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FestgridBackendStack } from './festgrid-backend-stack.js';

// The invariant-sweep suite (Epic 0.i3): checks that hold across EVERY resource of a kind in the
// synthesized stack, so a new Lambda cannot be added without them applying to it.
//
//   - Every Lambda declares a timeout (Story 0.i3b): this file.
//   - Every queue-url env var has a matching sqs:* grant (Story 0.i3c): the
//     "every Lambda queue-url env var has a matching SQS IAM grant" walker in
//     festgrid-backend-stack.test.ts. It is the 0.i3c check; no secret-ARN env var exists to cover
//     (secrets are resolved into the environment at deploy time, not read at runtime).
//
// They run in CI as part of `pnpm run test` (the "Continuous Integration" job). That the suite runs
// and that its job keeps its name are asserted by ci-wiring.test.ts. Whether a red run blocks a
// merge is a GitHub ruleset setting that no file in the repository can assert; see SETUP_WALKTHROUGH.md.

/** What `stage: 'prod'` requires to synthesize (the stack refuses to build without them). */
const PROD_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'test@example.com',
  SES_FROM_EMAIL_ADDRESS: 'noreply@example.com',
  WEB_APP_BASE_URL: 'https://example.com',
} as const;

/** The application Lambdas, by the logical-id prefix CDK derives from each construct id. */
const APPLICATION_LAMBDAS = ['ApiLambda', 'ScraperLambda', 'AIProcessorLambda', 'IngestorLambda', 'NotifierLambda', 'Webhook', 'ApifyWebhook'] as const;

/** Lambda's own ceiling. CDK refuses to synthesize a larger value, so this guards a typo in a template edit. */
const LAMBDA_MAX_TIMEOUT_SECONDS = 900;

function synthesizedLambdas(stageName: 'dev' | 'prod'): Array<[string, Record<string, unknown>]> {
  const original: Record<string, string | undefined> = {};
  if (stageName === 'prod') {
    for (const [key, value] of Object.entries(PROD_ENV)) {
      original[key] = process.env[key];
      process.env[key] = value;
    }
  }
  try {
    const app = new cdk.App();
    const stack = new FestgridBackendStack(app, `InvariantSweep-${stageName}`, { stageName });
    const resources = Template.fromStack(stack).toJSON().Resources as Record<string, { Type: string; Properties?: Record<string, unknown> }>;
    return Object.entries(resources)
      .filter(([, resource]) => resource.Type === 'AWS::Lambda::Function')
      .map(([logicalId, resource]) => [logicalId, resource.Properties ?? {}]);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

for (const stageName of ['dev', 'prod'] as const) {
  test(`invariant sweep (Story 0.i3b): every ${stageName} Lambda declares a timeout`, () => {
    const lambdas = synthesizedLambdas(stageName);

    // Not vacuous: all seven application Lambdas are in the template, including the two that shipped
    // without a timeout in BUG-002 (AIProcessorLambda, IngestorLambda). Non-prod stages also carry
    // CDK's own S3 auto-delete singleton, which the loop below covers without naming it.
    for (const required of APPLICATION_LAMBDAS) {
      assert.ok(
        lambdas.some(([logicalId]) => logicalId.startsWith(required)),
        `expected the ${required} function in the ${stageName} stack`,
      );
    }

    const problems: string[] = [];
    for (const [logicalId, properties] of lambdas) {
      const timeout = properties.Timeout;
      if (timeout === undefined) {
        problems.push(
          `${logicalId}: no Timeout, so it runs with Lambda's 3-second default. Set \`timeout\` on the function (or on sharedLambdaProps).`,
        );
      } else if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 1 || timeout > LAMBDA_MAX_TIMEOUT_SECONDS) {
        problems.push(`${logicalId}: Timeout is ${JSON.stringify(timeout)}, expected 1-${LAMBDA_MAX_TIMEOUT_SECONDS} seconds.`);
      }
    }
    assert.deepStrictEqual(problems, [], `Lambda timeout check failed in the ${stageName} stack:\n  - ${problems.join('\n  - ')}`);
  });
}
