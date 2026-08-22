import { test } from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
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
});
