/* eslint-disable turbo/no-undeclared-env-vars */
import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class FestgridEmailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stageName = this.node.tryGetContext('stage') || 'dev';
    const domainName = process.env.SES_SENDING_DOMAIN || `festdaily.app`;

    const emailIdentity = new ses.EmailIdentity(this, 'FestgridEmailIdentity', {
      identity: ses.Identity.domain(domainName),
      dkimIdentity: ses.DkimIdentity.easyDkim(
        ses.EasyDkimSigningKeyLength.RSA_1024_BIT
      ),
    });

    const lApiRole = new iam.Role(this, 'FestgridLApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: `festgrid-l-api-role-${stageName}`,
    });

    lApiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [emailIdentity.emailIdentityArn],
      })
    );

    new cdk.CfnOutput(this, 'EmailIdentityDkimTokens', {
      value: cdk.Fn.join(',', emailIdentity.dkimRecords.map(r => r.value)),
      description: 'DKIM validation tokens for DNS verification',
    });
  }
}
