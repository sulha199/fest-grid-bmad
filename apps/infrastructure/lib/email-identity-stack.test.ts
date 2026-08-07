import test from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { FestgridEmailStack } from './email-identity-stack.js';

test('FestgridEmailStack infrastructure assertion tests', async (t) => {
  await t.test('provisions exactly one SES EmailIdentity and correct IAM policy', () => {
    const app = new cdk.App();
    const stack = new FestgridEmailStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::SES::EmailIdentity', 1);

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['ses:SendEmail', 'ses:SendRawEmail'],
            Effect: 'Allow',
            Resource: Match.anyValue(),
          }),
        ]),
      }),
    });
  });
});
