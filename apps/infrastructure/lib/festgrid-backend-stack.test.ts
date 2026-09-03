import { test } from 'node:test';
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

  // 11. Story 0.33 / Architecture Spine AD-12: exactly 1 private S3 bucket for post media,
  // with public access fully blocked.
  template.resourceCountIs('AWS::S3::Bucket', 1);
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
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

  // 13b. Assert L_API (apiLambda) holds an IAM grant to send onto AIProcessingQueue
  // specifically (Resource scoped to that queue's own ARN, not merged with the
  // adjacent ScrapingQueue grant statement) — regression test for a confirmed prod
  // incident where AI_PROCESSING_QUEUE_URL was wired into apiLambda's environment
  // (#9 above) with no matching grantSendMessages() call, causing every
  // selectPostsForExtraction call to fail with SQS AccessDenied.
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(['sqs:SendMessage']),
          Effect: 'Allow',
          Resource: {
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('^AIProcessingQueue')]),
          },
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
      }),
    },
  });
});
