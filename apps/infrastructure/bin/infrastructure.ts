/* eslint-disable turbo/no-undeclared-env-vars */
import * as cdk from 'aws-cdk-lib';
import { FestgridBackendStack } from '../lib/festgrid-backend-stack.js';

const app = new cdk.App();

const deployStage = process.env.DEPLOY_STAGE; // 'dev' | 'staging' | 'prod' | undefined

const defaultEnv = {
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

if (!deployStage || deployStage === 'dev') {
  new FestgridBackendStack(app, 'FestgridBackendStack-dev', {
    stageName: 'dev',
    env: defaultEnv,
  });
}

if (!deployStage || deployStage === 'staging') {
  new FestgridBackendStack(app, 'FestgridBackendStack-staging', {
    stageName: 'staging',
    env: defaultEnv,
  });
}

if (!deployStage || deployStage === 'prod') {
  new FestgridBackendStack(app, 'FestgridBackendStack-prod', {
    stageName: 'prod',
    env: defaultEnv,
  });
}
