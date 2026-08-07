#!/usr/bin/env node
/* eslint-disable turbo/no-undeclared-env-vars */
import * as cdk from 'aws-cdk-lib';
import { FestgridEmailStack } from '../lib/email-identity-stack.js';

const app = new cdk.App();
new FestgridEmailStack(app, 'FestgridEmailStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
