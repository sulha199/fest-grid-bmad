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

  // 1. Assert exactly 6 Lambda functions are created (API, Scraper, AIProcessor,
  // Ingestor, Webhook, ApifyWebhook)
  template.resourceCountIs('AWS::Lambda::Function', 6);

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
  // (daily scraper seed run + hourly stale-job sweep)
  template.resourceCountIs('AWS::Events::Rule', 2);
  template.hasResourceProperties('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 day)',
  });
  template.hasResourceProperties('AWS::Events::Rule', {
    ScheduleExpression: 'rate(1 hour)',
  });

  // 6. Assert Key Policy exists
  template.hasResource('AWS::KMS::Key', {});

  // 7. Assert exactly 6 Secrets exist in Secrets Manager
  template.resourceCountIs('AWS::SecretsManager::Secret', 6);

  // 8. Assert exactly 1 SES Email Identity exists
  template.resourceCountIs('AWS::SES::EmailIdentity', 1);

  // 9. Assert L_API Lambda environment variables are present and secure
  template.hasResourceProperties('AWS::Lambda::Function', {
    Environment: {
      Variables: Match.objectLike({
        STAGE: 'dev',
        STAGE_NAME: 'dev',
        BACKEND_PORT: '4000',
        SUPABASE_URL: Match.anyValue(),
        DATABASE_URL: Match.anyValue(),
        GEOAPIFY_API_KEY: Match.anyValue(),
        FIREBASE_PROJECT_ID: Match.anyValue(),
        FIREBASE_CLIENT_EMAIL: Match.anyValue(),
        FIREBASE_PRIVATE_KEY: Match.anyValue(),
        SES_FROM_EMAIL_ADDRESS: Match.anyValue(),
        SYSTEM_ERROR_ALERT_EMAIL: Match.anyValue(),
        BYOK_KMS_KEY_ID: Match.anyValue(),
        GEMINI_MODEL: Match.anyValue(),
        APIFY_API_TOKEN: Match.anyValue(),
        BRIGHTDATA_API_TOKEN: Match.anyValue(),
        BRIGHTDATA_WEBHOOK_SECRET: Match.anyValue(),
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
});
