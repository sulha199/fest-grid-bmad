import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { FestgridBackendStack } from './festgrid-backend-stack.js';

test('FestgridBackendStack provisions correct resources', () => {
  const app = new cdk.App();
  const stack = new FestgridBackendStack(app, 'TestStack', {
    stageName: 'dev',
  });

  const template = Template.fromStack(stack);

  // 1. Assert exactly 8 Lambda functions are created (API, Scraper, AIProcessor, Ingestor,
  // Webhook, ApifyWebhook, Notifier, plus CDK's own internal `Custom::S3AutoDeleteObjects`
  // singleton Lambda — an automatic side effect of the post-media bucket's
  // `autoDeleteObjects: true` in non-prod stages (Story 0.33), not an application Lambda).
  template.resourceCountIs('AWS::Lambda::Function', 8);

  // 2. Assert exactly 6 SQS queues exist (3 main + 3 DLQs)
  template.resourceCountIs('AWS::SQS::Queue', 6);

  // 3. Assert exactly 1 KMS Key exists with key rotation enabled
  template.resourceCountIs('AWS::KMS::Key', 1);
  template.hasResourceProperties('AWS::KMS::Key', {
    EnableKeyRotation: true,
  });

  // 4. Assert exactly 1 API Gateway REST API exists
  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);

  // 5. Assert the EventBridge scheduled rules exist with the correct rates
  // (daily scraper seed run + hourly stale-job sweep + daily notifier sweep)
  template.resourceCountIs('AWS::Events::Rule', 3);
  template.hasResourceProperties('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 day)',
  });
  template.hasResourceProperties('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 hour)',
  });

  // 5b. Assert one of the rate(1 day) rules targets the NotifierLambda specifically
  template.hasResourceProperties('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 day)',
    Targets: Match.arrayWith([
      Match.objectLike({
        Arn: {
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^NotifierLambda')]),
        },
      }),
    ]),
  });

  // 6. Assert Key Policy exists
  template.hasResource('AWS::KMS::Key', {});

  // 7. Assert exactly 7 Secrets exist in Secrets Manager
  template.resourceCountIs('AWS::SecretsManager::Secret', 7);

  // 8. Assert exactly 1 SES Email Identity exists
  template.resourceCountIs('AWS::SES::EmailIdentity', 1);

  // 9. Assert L_API Lambda environment variables are present and secure
  template.hasResourceProperties('AWS::Lambda::Function', {
    Environment: {
      Variables: Match.objectLike({
        STAGE: 'dev',
        BACKEND_PORT: '4000',
        SUPABASE_URL: Match.anyValue(),
        DATABASE_URL: Match.anyValue(),
        GEOAPIFY_API_KEY: Match.anyValue(),
        SYSTEM_GEMINI_API_KEY: Match.anyValue(),
        FIREBASE_PROJECT_ID: Match.anyValue(),
        FIREBASE_CLIENT_EMAIL: Match.anyValue(),
        FIREBASE_PRIVATE_KEY: Match.anyValue(),
        SES_FROM_EMAIL_ADDRESS: Match.anyValue(),
        BYOK_KMS_KEY_ID: Match.anyValue(),
        APIFY_API_TOKEN: Match.anyValue(),
        BRIGHTDATA_API_TOKEN: Match.anyValue(),
        BRIGHTDATA_WEBHOOK_SECRET: Match.anyValue(),
      }),
    },
  });

  // 9b. Assert L_Notifier Lambda environment variables are present (full AC5 var set).
  // Combined with Timeout: 300 to disambiguate from L_API (Timeout 25) and the other
  // batch Lambdas (Scraper/AIProcessor/Ingestor), which don't carry SES_FROM_EMAIL_ADDRESS/
  // WEB_APP_BASE_URL/QUEUE_NOTIFICATION_* in their environment.
  template.hasResourceProperties('AWS::Lambda::Function', {
    Timeout: 300,
    Environment: {
      Variables: Match.objectLike({
        STAGE: 'dev',
        BACKEND_PORT: '4000',
        DATABASE_URL: Match.anyValue(),
        SES_FROM_EMAIL_ADDRESS: Match.anyValue(),
        WEB_APP_BASE_URL: Match.anyValue(),
        QUEUE_NOTIFICATION_THRESHOLD_DAYS: Match.anyValue(),
        QUEUE_NOTIFICATION_THRESHOLD_COUNT: Match.anyValue(),
        QUEUE_NOTIFICATION_COOLDOWN_DAYS: Match.anyValue(),
      }),
    },
  });

  // 9c. Assert L_Scrape Lambda environment variables are present (Timeout: 300 to disambiguate from L_API and others)
  template.hasResourceProperties('AWS::Lambda::Function', {
    Timeout: 300,
    Environment: {
      Variables: Match.objectLike({
        STAGE: 'dev',
        BACKEND_PORT: '4000',
        DATABASE_URL: Match.anyValue(),
        SCRAPING_QUEUE_URL: Match.anyValue(),
        APIFY_API_TOKEN: Match.anyValue(),
        BRIGHTDATA_API_TOKEN: Match.anyValue(),
        BRIGHTDATA_DATASET_ID: Match.anyValue(),
        BYOK_KMS_KEY_ID: Match.anyValue(),
        GEOAPIFY_API_KEY: Match.anyValue(),
        SYSTEM_GEMINI_API_KEY: Match.anyValue(),
        SES_FROM_EMAIL_ADDRESS: Match.anyValue(),
        WEB_APP_BASE_URL: Match.anyValue(),
        SCRAPE_SKIP_RECENT_HOURS: '12',
      }),
    },
  });

  // 10. Assert SES send email grant is present in the Lambda execution role policy
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(['ses:SendEmail', 'ses:SendRawEmail']),
          Effect: 'Allow',
          Resource: Match.anyValue(),
        }),
      ]),
    },
  });

  // 11. Story 0.33 / Architecture Spine AD-12: exactly 2 private S3 buckets — post-media
  // (public-facing via CloudFront/OAC) and the Ops Backfill staging bucket (2026-09-05
  // scraper-audit-trail incident, docs/infrastructure/incidents/2026-09-05-scraper-audit-trail-gap.md) —
  // both with public access fully blocked.
  template.resourceCountIs('AWS::S3::Bucket', 2);
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });

  // 11b. Ops Backfill Bucket specifically: private, SSE-S3 encrypted, and objects
  // auto-expire after 7 days so stale backfill inputs don't linger indefinitely.
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: Match.arrayWith([
        Match.objectLike({
          ServerSideEncryptionByDefault: Match.objectLike({ SSEAlgorithm: 'AES256' }),
        }),
      ]),
    },
    LifecycleConfiguration: {
      Rules: Match.arrayWith([
        Match.objectLike({
          Status: 'Enabled',
          ExpirationInDays: 7,
        }),
      ]),
    },
  });

  // 12. Exactly 1 CloudFront distribution and 1 Origin Access Control fronting the bucket.
  template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);

  // 13. Assert an IAM policy statement grants s3:PutObject (the AI-extraction Lambda's scoped
  // write permission on the post-media bucket) — no read/list/delete action is asserted here,
  // since grantPut() only ever produces write-adjacent actions.
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(['s3:PutObject']),
          Effect: 'Allow',
        }),
      ]),
    },
  });

  // 14. Assert L_AI (aiProcessorLambda) environment contains the two new post-media vars.
  // Combined with Timeout: 300 + DATA_INGESTION_QUEUE_URL (already unique to this Lambda's
  // environment) to disambiguate it from the other 300s batch Lambdas (Scraper/Ingestor), which
  // don't carry DATA_INGESTION_QUEUE_URL/POST_MEDIA_* vars.
  template.hasResourceProperties('AWS::Lambda::Function', {
    Timeout: 300,
    Environment: {
      Variables: Match.objectLike({
        DATA_INGESTION_QUEUE_URL: Match.anyValue(),
        POST_MEDIA_BUCKET_NAME: Match.anyValue(),
        POST_MEDIA_CDN_DOMAIN: Match.anyValue(),
        POST_MEDIA_DISTRIBUTION_ID: Match.anyValue(),
      }),
    },
  });

  // 15. Story 0.40 / FIND-034: dev stack with no context -- all 3 target Lambdas' ESM
  // (scraper/aiProcessor/ingestor queues) exist but disabled by default (AC1).
  template.resourceCountIs('AWS::Lambda::EventSourceMapping', 3);
  template.allResourcesProperties('AWS::Lambda::EventSourceMapping', {
    Enabled: false,
  });

  // 16. Story 3.6q / AD-28 Rule 9: PostMediaCacheHeadersPolicy's Cache-Control value is 7-day
  // immutable (not the old 1-year value) now that re-hosted media keys are content-versioned.
  template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
    ResponseHeadersPolicyConfig: Match.objectLike({
      CustomHeadersConfig: {
        Items: Match.arrayWith([
          Match.objectLike({
            Header: 'Cache-Control',
            Override: true,
            Value: 'public, max-age=604800, immutable',
          }),
        ]),
      },
    }),
  });

  // 17. Story 3.6q / AD-28 Rule 9: aiProcessorLambda's IAM role holds a cloudfront:CreateInvalidation
  // grant (via postMediaDistribution.grantCreateInvalidation), needed to invalidate a superseded
  // content-versioned key's cached edge responses after deleting the underlying S3 object.
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'cloudfront:CreateInvalidation',
          Effect: 'Allow',
        }),
      ]),
    },
  });

  // 18. Story 3.6q / AD-28 Rule 9: aiProcessorLambda's IAM role also holds s3:DeleteObject* on the
  // post-media bucket (via postMediaBucket.grantDelete, which synthesizes as a single-string
  // "s3:DeleteObject*" Action, not an array — confirmed against this file's real synthesized
  // output before asserting), alongside the existing s3:PutObject grant (test 13 above) — both
  // needed for the best-effort cleanup of a superseded key.
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 's3:DeleteObject*',
          Effect: 'Allow',
        }),
      ]),
    },
  });
});

// FIND-017 Gap 3: generic env-var-to-grant walker — generalizes the old test 13b (previously:
// apiLambda must hold an sqs:SendMessage grant on AIProcessingQueue specifically, a regression
// test for a confirmed prod incident where AI_PROCESSING_QUEUE_URL was wired into apiLambda's
// environment with no matching grantSendMessages() call) to the whole class: for every
// synthesized Lambda's *_QUEUE_URL env var that is a direct `Ref` to a queue defined in this
// template, assert some IAM::Policy attached to that Lambda's role grants an sqs:* action
// scoped to that queue's ARN. Catches both a missing grant on an existing queue var (the
// original incident shape) and a wired-but-ungranted var on any future Lambda — and would have
// caught apiLambda's unused, ungranted DATA_INGESTION_QUEUE_URL (removed in this same diff) had
// it carried an actual code dependency instead of being dead.
//
// Kept as its own top-level test (not appended to the 289-line resource-provisioning test above)
// so a failure here can't silently mask/abort unrelated later assertions in that test.
//
// Scoped to queue env vars only: a secret's `secretValue.unsafeUnwrap()` synthesizes as a
// `{{resolve:secretsmanager:...}}` dynamic-reference *string*, not a `Ref`/`Fn::GetAtt` object,
// so it isn't mechanically walkable the same way — secrets stay covered only by their existing
// per-secret `grantRead` calls. Also scoped to direct in-template `Ref`s: an imported/cross-stack
// queue URL (a hardcoded string, or a `Fn::ImportValue`) is out of this walker's scope, same as
// it was out of scope for the test it replaces.
test('FestgridBackendStack: every Lambda queue-url env var has a matching SQS IAM grant (generalizes 13b / DW-088)', () => {
  const app = new cdk.App();
  const stack = new FestgridBackendStack(app, 'TestStackGrantWalker', {
    stageName: 'dev',
  });

  const template = Template.fromStack(stack);
  const resources = template.toJSON().Resources as Record<string, {
    Type: string;
    Properties?: Record<string, unknown>;
  }>;

  const queueLogicalIds = new Set(
    Object.entries(resources)
      .filter(([, r]) => r.Type === 'AWS::SQS::Queue')
      .map(([id]) => id)
  );

  const lambdaEntries = Object.entries(resources).filter(([, r]) => r.Type === 'AWS::Lambda::Function');
  assert.ok(lambdaEntries.length > 0, 'expected at least one AWS::Lambda::Function in the synthesized template');

  let checkedCount = 0;

  for (const [lambdaId, lambdaResource] of lambdaEntries) {
    const props = lambdaResource.Properties ?? {};
    const roleProp = props.Role as { 'Fn::GetAtt'?: [string, string] } | undefined;
    const roleLogicalId = roleProp?.['Fn::GetAtt']?.[0];
    const envVars = (props.Environment as { Variables?: Record<string, unknown> } | undefined)?.Variables ?? {};

    for (const [envKey, envVal] of Object.entries(envVars)) {
      if (!envKey.endsWith('_QUEUE_URL')) continue;
      const refLogicalId = (envVal as { Ref?: string } | undefined)?.Ref;
      // Only a direct Ref to a queue defined in this template is a walkable case
      // (e.g. a hardcoded/imported URL string is out of this walker's scope).
      if (!refLogicalId || !queueLogicalIds.has(refLogicalId)) continue;

      // A Lambda whose role isn't a direct in-template Fn::GetAtt (e.g. an imported role) can't
      // be walked either — fail loudly naming the real cause, rather than silently matching an
      // unrelated ungated policy statement via an undefined-to-undefined role comparison.
      assert.ok(
        roleLogicalId,
        `Lambda "${lambdaId}" has env var "${envKey}" referencing queue "${refLogicalId}", but its Role could not be resolved to an in-template Fn::GetAtt for grant walking`
      );

      checkedCount += 1;

      const matchingPolicy = Object.values(resources).find((r) => {
        if (r.Type !== 'AWS::IAM::Policy') return false;
        const policyProps = r.Properties ?? {};
        const roles = (policyProps.Roles as Array<{ Ref?: string }> | undefined) ?? [];
        const attachedToRole = roles.some((roleEntry) => roleEntry?.Ref === roleLogicalId);
        if (!attachedToRole) return false;

        const doc = policyProps.PolicyDocument as { Statement?: Array<Record<string, unknown>> } | undefined;
        const statements = doc?.Statement ?? [];
        return statements.some((stmt) => {
          const rawAction = stmt.Action;
          const actions = Array.isArray(rawAction) ? rawAction : [rawAction];
          const isSqsAction = actions.some((a) => typeof a === 'string' && a.startsWith('sqs:'));
          if (!isSqsAction || stmt.Effect !== 'Allow') return false;

          const rawResource = stmt.Resource;
          const resourceEntries = Array.isArray(rawResource) ? rawResource : [rawResource];
          return resourceEntries.some((res) => {
            const getAtt = (res as { 'Fn::GetAtt'?: [string, string] } | undefined)?.['Fn::GetAtt'];
            return getAtt?.[0] === refLogicalId;
          });
        });
      });

      assert.ok(
        matchingPolicy,
        `Lambda "${lambdaId}" has env var "${envKey}" referencing queue "${refLogicalId}" with no matching sqs:* IAM grant on its role`
      );
    }
  }

  // Guards against a future rename of the `_QUEUE_URL` suffix convention silently reducing this
  // walker to zero iterations (a vacuous pass that would still print green).
  assert.ok(checkedCount > 0, 'expected at least one *_QUEUE_URL env var to be walked across all Lambdas');
});

test('FestgridBackendStack: dev stack with enableNonProdQueuePolling=true context enables the ESM (AC2)', () => {
  const app = new cdk.App({ context: { enableNonProdQueuePolling: 'true' } });
  const stack = new FestgridBackendStack(app, 'TestStackDevPollingEnabled', {
    stageName: 'dev',
  });

  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::Lambda::EventSourceMapping', 3);
  template.allResourcesProperties('AWS::Lambda::EventSourceMapping', {
    Enabled: true,
  });
});

test('FestgridBackendStack: prod stack replaces the ESM with scheduled poll-and-drain (AC3/AC7/AC8/AC11)', () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    SES_FROM_EMAIL_ADDRESS: process.env.SES_FROM_EMAIL_ADDRESS,
    WEB_APP_BASE_URL: process.env.WEB_APP_BASE_URL,
  };

  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
    process.env.SES_FROM_EMAIL_ADDRESS = 'noreply@example.com';
    process.env.WEB_APP_BASE_URL = 'https://example.com';

    const app = new cdk.App();
    const stack = new FestgridBackendStack(app, 'TestStackProd', {
      stageName: 'prod',
    });

    const template = Template.fromStack(stack);

    // AC3: zero EventSourceMapping resources for the 3 queues in prod.
    template.resourceCountIs('AWS::Lambda::EventSourceMapping', 0);

    // AC3: exactly 3 new rate(5 minutes) rules, each carrying the poll-and-drain marker
    // payload and targeting one of the 3 Lambdas.
    template.resourceCountIs('AWS::Events::Rule', 6); // 1 daily scraper + 1 daily notifier + 1 hourly stale-sweep + 3 new poll-and-drain
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(5 minutes)',
      Targets: Match.arrayWith([
        Match.objectLike({
          Arn: {
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^ScraperLambda')]),
          },
          Input: JSON.stringify({ jobType: 'poll-and-drain' }),
        }),
      ]),
    });
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(5 minutes)',
      Targets: Match.arrayWith([
        Match.objectLike({
          Arn: {
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^AIProcessorLambda')]),
          },
          Input: JSON.stringify({ jobType: 'poll-and-drain' }),
        }),
      ]),
    });
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(5 minutes)',
      Targets: Match.arrayWith([
        Match.objectLike({
          Arn: {
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^IngestorLambda')]),
          },
          Input: JSON.stringify({ jobType: 'poll-and-drain' }),
        }),
      ]),
    });

    // AC7: aiProcessorLambda/ingestorLambda each gain their own input queue's URL. Scoped by
    // logical ID prefix (not a bare hasResourceProperties match) since aiProcessorLambda
    // already carries DATA_INGESTION_QUEUE_URL as its pre-existing *output*-queue var -- an
    // unscoped match on that property alone would still pass even if ingestorLambda's own
    // addEnvironment call for it were removed, since aiProcessorLambda independently
    // satisfies the same property match (Review Finding, Story 0.40 code review).
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    const findLambdaByPrefix = (prefix: string) => {
      const entry = Object.entries(lambdaFunctions).find(([logicalId]) => logicalId.startsWith(prefix));
      assert.ok(entry, `expected a "${prefix}*" function in the synthesized template`);
      return entry![1].Properties.Environment.Variables as Record<string, unknown>;
    };

    const aiProcessorEnvVars = findLambdaByPrefix('AIProcessorLambda');
    assert.ok(
      'AI_PROCESSING_QUEUE_URL' in aiProcessorEnvVars,
      'aiProcessorLambda should have its own new AI_PROCESSING_QUEUE_URL (input queue)'
    );
    assert.ok(
      'DATA_INGESTION_QUEUE_URL' in aiProcessorEnvVars,
      'aiProcessorLambda should retain its pre-existing DATA_INGESTION_QUEUE_URL (output queue)'
    );

    const ingestorEnvVars = findLambdaByPrefix('IngestorLambda');
    assert.ok(
      'DATA_INGESTION_QUEUE_URL' in ingestorEnvVars,
      'ingestorLambda should have its own new DATA_INGESTION_QUEUE_URL (input queue)'
    );

    // AC8: grantConsumeMessages-derived IAM policy statements exist for all 3 queues.
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes']),
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^ScrapingQueue')]),
            },
          }),
        ]),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes']),
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^AIProcessingQueue')]),
            },
          }),
        ]),
      },
    });
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes']),
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^DataIngestionQueue')]),
            },
          }),
        ]),
      },
    });
  } finally {
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    process.env.FIREBASE_PROJECT_ID = originalEnv.FIREBASE_PROJECT_ID;
    process.env.FIREBASE_CLIENT_EMAIL = originalEnv.FIREBASE_CLIENT_EMAIL;
    process.env.SES_FROM_EMAIL_ADDRESS = originalEnv.SES_FROM_EMAIL_ADDRESS;
    process.env.WEB_APP_BASE_URL = originalEnv.WEB_APP_BASE_URL;
  }
});

// Story 0.46 (AC1): aiProcessorLambda gets an explicit, measurement-backed MemorySize and
// Architectures (see this story's Dev Notes for the measured peak-RSS numbers behind 2048 MB
// and the Docker-bundling-on-Windows finding behind choosing X86_64). Uses findLambdaByPrefix
// (not a bare hasResourceProperties match) since aiProcessorLambda shares its 300s Timeout with
// other batch Lambdas (Scraper/Ingestor) -- the same false-positive class flagged in the Story
// 0.40 code-review comment above (test "prod stack replaces the ESM...").
test('FestgridBackendStack: aiProcessorLambda has the measurement-backed MemorySize/Architecture (Story 0.46 AC1)', () => {
  const app = new cdk.App();
  const stack = new FestgridBackendStack(app, 'TestStack046Memory', {
    stageName: 'dev',
  });

  const template = Template.fromStack(stack);
  const lambdaFunctions = template.findResources('AWS::Lambda::Function');
  const entry = Object.entries(lambdaFunctions).find(([logicalId]) => logicalId.startsWith('AIProcessorLambda'));
  assert.ok(entry, 'expected an "AIProcessorLambda*" function in the synthesized template');
  const props = entry[1].Properties as Record<string, unknown>;

  assert.strictEqual(props.MemorySize, 2048, 'aiProcessorLambda MemorySize should be the measurement-backed 2048 MB');
  assert.deepStrictEqual(props.Architectures, ['x86_64'], 'aiProcessorLambda Architectures should be x86_64');
  assert.strictEqual(props.Timeout, 300, 'aiProcessorLambda Timeout should remain unchanged at 300s');

  // Regression guard: no OTHER Lambda in the stack gained a MemorySize/Architectures override
  // from this change (AC1: "No other Lambda's configuration changes").
  for (const [logicalId, resource] of Object.entries(lambdaFunctions)) {
    if (logicalId.startsWith('AIProcessorLambda')) continue;
    // CDK's own internal Custom::S3AutoDeleteObjects singleton handler (an automatic side
    // effect of postMediaBucket's autoDeleteObjects: true in non-prod stages, Story 0.33) --
    // not an application Lambda this file defines, and CDK bakes its own MemorySize: 128
    // default into it regardless of anything in this stack. Excluded for the same reason the
    // "provisions correct resources" test's Lambda-count comment already excludes it.
    if (logicalId.startsWith('CustomS3AutoDeleteObjectsCustomResourceProviderHandler')) continue;
    const otherProps = resource.Properties as Record<string, unknown>;
    assert.strictEqual(
      otherProps.MemorySize,
      undefined,
      `expected "${logicalId}" to have no explicit MemorySize override (only aiProcessorLambda does, per AC1)`
    );
    assert.strictEqual(
      otherProps.Architectures,
      undefined,
      `expected "${logicalId}" to have no explicit Architectures override (only aiProcessorLambda does, per AC1)`
    );
  }
});

// Story 0.46 (AC2/AC3/AC6) + Story 3.6n (wires the real detection in, re-measures): the
// synthesized asset for aiProcessorLambda actually contains sharp's native binary package (via
// `bundling.nodeModules`), the REAL @vladmandic/face-api + @tensorflow/tfjs +
// @tensorflow/tfjs-backend-wasm code now inlined directly into index.js (reachable from
// `ai-processor.ts`'s own import graph via `process-ai-job.ts` -> `detect-and-blur-faces.ts`,
// Story 3.6n), with the SSD MobileNetV1 model weights and the tfjs-backend-wasm `.wasm`
// binaries copied alongside it by `bundling.commandHooks.afterBundling` (see
// `bundle-ai-processor-face-detection-assets.cjs` and the `bundling` comment on
// aiProcessorLambda in festgrid-backend-stack.ts for the full history -- an earlier
// `bundling.nodeModules`-only approach measured 321-345 MB unzipped, over Lambda's 250 MB
// limit; Story 0.46 originally proved the esbuild-inlining fix via a separate pass over an
// inert probe module since its own AC7 forbade wiring the real stage in yet -- Story 3.6n's
// real wiring now gets the same effect "for free" from CDK's own primary bundling pass, so
// that separate pass and its probe module were removed). Uses a controlled `outdir` (not the
// default random temp dir) so this test can walk the synthesized asset directories on disk
// after `app.synth()`.
test('FestgridBackendStack: aiProcessorLambda bundle contains sharp native binary, the real inlined face-detection code, SSD MobileNetV1 weights, and .wasm files, all within Lambda zip limits (Story 0.46 AC2/AC3/AC6, re-measured by Story 3.6n)', () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-story-3-6n-asset-'));
  try {
    const app = new cdk.App({ outdir });
    const stack = new FestgridBackendStack(app, 'TestStack36nAssets', {
      stageName: 'dev',
    });
    // Force bundling to actually run and stage files under outdir.
    app.synth();

    const assetEntries = fs.readdirSync(outdir).filter((name) => name.startsWith('asset.'));
    assert.ok(assetEntries.length > 0, 'expected at least one staged asset directory under the synth outdir');

    // aiProcessorLambda's bundle is identified by the model/ directory copied alongside its
    // index.js (commandHooks.afterBundling) -- no other Lambda in this stack gets that asset.
    const aiProcessorAssetDir = assetEntries
      .map((name) => path.join(outdir, name))
      .find((dir) => fs.existsSync(path.join(dir, 'model', 'ssd_mobilenetv1_model.bin')));
    assert.ok(
      aiProcessorAssetDir,
      'expected a staged asset directory containing model/ssd_mobilenetv1_model.bin (the aiProcessorLambda bundle)'
    );

    // AC2: sharp's platform/arch-specific native binary package is present (name depends on
    // the host that ran this test -- e.g. @img/sharp-win32-x64 on Windows, @img/sharp-linux-x64
    // on CI/Linux; this assertion is intentionally host-agnostic, see Dev Notes for the
    // documented Windows-dev-machine-vs-CI architecture caveat).
    const imgScopeDir = path.join(aiProcessorAssetDir, 'node_modules', '@img');
    assert.ok(fs.existsSync(imgScopeDir), 'expected node_modules/@img (sharp native binary scope) in the bundle');
    const sharpNativePackages = fs.readdirSync(imgScopeDir).filter((name) => name.startsWith('sharp-'));
    assert.ok(
      sharpNativePackages.length > 0,
      'expected at least one @img/sharp-<platform>-<arch> native binary package in the bundle'
    );

    // AC2/AC4 (bundling half) + Story 3.6n: index.js itself (ai-processor.ts's real entry) is
    // now non-trivial in size, proving it actually contains the real, inlined face-api/tfjs
    // code -- not just its own pre-existing handler logic. Pre-3.6n, this same entry measured
    // well under 500KB (confirmed by re-running this assertion against main before this
    // story's changes).
    const indexPath = path.join(aiProcessorAssetDir, 'index.js');
    assert.ok(fs.existsSync(indexPath), 'expected index.js (ai-processor.ts bundle) in the asset');
    const indexBytes = fs.statSync(indexPath).size;
    assert.ok(
      indexBytes > 500_000,
      `expected index.js to be a substantial bundle after inlining the real face-api/tfjs code (>500KB), got ${indexBytes} bytes`
    );

    // AC3: SSD MobileNetV1 weights + manifest present at the documented runtime path (sibling
    // to index.js, i.e. a `model/` dir directly under the Lambda's deployment root --
    // resolvable at runtime via `path.join(process.env.LAMBDA_TASK_ROOT, 'model')`, the
    // convention detect-and-blur-faces.ts's resolveModelDir() uses).
    const modelDir = path.join(aiProcessorAssetDir, 'model');
    assert.ok(
      fs.existsSync(path.join(modelDir, 'ssd_mobilenetv1_model.bin')),
      'expected ssd_mobilenetv1_model.bin in the bundled asset'
    );
    assert.ok(
      fs.existsSync(path.join(modelDir, 'ssd_mobilenetv1_model-weights_manifest.json')),
      'expected the SSD MobileNetV1 weights manifest in the bundled asset'
    );

    // AC4 (bundling half): tfjs-backend-wasm's .wasm binaries present alongside index.js (not
    // nested under node_modules -- its own dist/tf-backend-wasm.node.js resolves them via
    // __dirname-relative fs.readFileSync, verified by inspection, and __dirname for the
    // bundled index.js IS this directory -- no setWasmPaths call needed).
    const wasmFiles = fs.readdirSync(aiProcessorAssetDir).filter((name) => name.endsWith('.wasm'));
    assert.ok(wasmFiles.length > 0, 'expected at least one .wasm file alongside index.js');

    // AC6: the real synthesized asset's total on-disk (unzipped) size is comfortably within
    // Lambda's 250 MB unzipped deployment-package limit -- regression guard for the AC6 fix
    // (esbuild-inlining the real packages instead of a raw `nodeModules` install, which
    // measured 321-345 MB and would have failed this same check).
    function dirSizeBytes(dir: string): number {
      let total = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        total += entry.isDirectory() ? dirSizeBytes(full) : fs.statSync(full).size;
      }
      return total;
    }
    const totalBytes = dirSizeBytes(aiProcessorAssetDir);
    const totalMb = totalBytes / 1024 / 1024;
    assert.ok(
      totalMb < 250,
      `expected aiProcessorLambda's synthesized asset to be under Lambda's 250 MB unzipped limit, measured ${totalMb.toFixed(1)} MB`
    );
  } finally {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
});

// Story 3.20 (Task 1.3/1.4, AC1): BLUR_FACES_BEFORE_AI is set explicitly in aiProcessorLambda's
// environment block, and ONLY there -- it is the sole caller of buildGeminiExtractionRequest with
// the image-processing runtime needed to run the pre-AI blur. Scoped by logical ID prefix (not an
// unscoped hasResourceProperties match), matching this file's own established precedent (see the
// AC7 comment above on aiProcessorEnvVars/ingestorEnvVars) for exactly this class of false
// positive.
test('FestgridBackendStack: aiProcessorLambda has BLUR_FACES_BEFORE_AI in its environment, and no other Lambda does (Story 3.20 AC1)', () => {
  const app = new cdk.App();
  const stack = new FestgridBackendStack(app, 'TestStack320BlurEnv', {
    stageName: 'dev',
  });

  const template = Template.fromStack(stack);
  const lambdaFunctions = template.findResources('AWS::Lambda::Function');

  const aiProcessorEntry = Object.entries(lambdaFunctions).find(([logicalId]) => logicalId.startsWith('AIProcessorLambda'));
  assert.ok(aiProcessorEntry, 'expected an "AIProcessorLambda*" function in the synthesized template');
  const aiProcessorEnvVars = (aiProcessorEntry[1].Properties as Record<string, { Variables: Record<string, unknown> }>)
    .Environment.Variables;
  assert.ok('BLUR_FACES_BEFORE_AI' in aiProcessorEnvVars, 'aiProcessorLambda should have BLUR_FACES_BEFORE_AI set');

  for (const [logicalId, resource] of Object.entries(lambdaFunctions)) {
    if (logicalId.startsWith('AIProcessorLambda')) continue;
    const props = resource.Properties as Record<string, { Variables?: Record<string, unknown> } | undefined>;
    const envVars = props.Environment?.Variables;
    if (!envVars) continue;
    assert.ok(
      !('BLUR_FACES_BEFORE_AI' in envVars),
      `expected "${logicalId}" to NOT have BLUR_FACES_BEFORE_AI (only aiProcessorLambda does, per AC1)`
    );
  }
});
