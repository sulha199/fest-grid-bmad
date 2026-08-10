import * as path from 'path';
import { fileURLToPath } from 'url';
import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface FestgridBackendStackProps extends cdk.StackProps {
  stageName: 'dev' | 'staging' | 'prod';
}

export class FestgridBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FestgridBackendStackProps) {
    super(scope, id, props);

    const { stageName } = props;
    const removalPolicy = stageName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // 1. KMS Key for BYOK
    const kmsKey = new kms.Key(this, `KmsKey-${stageName}`, {
      enableKeyRotation: true,
      alias: `alias/festgrid-byok-${stageName}`,
      removalPolicy,
    });

    // 2. SQS Queues & DLQs
    const scrapingDlq = new sqs.Queue(this, `ScrapingQueueDlq-${stageName}`, {
      queueName: `festgrid-scraping-queue-dlq-${stageName}`,
      removalPolicy,
    });
    const scrapingQueue = new sqs.Queue(this, `ScrapingQueue-${stageName}`, {
      queueName: `festgrid-scraping-queue-${stageName}`,
      deadLetterQueue: {
        queue: scrapingDlq,
        maxReceiveCount: 3,
      },
      removalPolicy,
    });

    const aiProcessingDlq = new sqs.Queue(this, `AIProcessingQueueDlq-${stageName}`, {
      queueName: `festgrid-ai-processing-queue-dlq-${stageName}`,
      removalPolicy,
    });
    const aiProcessingQueue = new sqs.Queue(this, `AIProcessingQueue-${stageName}`, {
      queueName: `festgrid-ai-processing-queue-${stageName}`,
      deadLetterQueue: {
        queue: aiProcessingDlq,
        maxReceiveCount: 3,
      },
      removalPolicy,
    });

    const dataIngestionDlq = new sqs.Queue(this, `DataIngestionQueueDlq-${stageName}`, {
      queueName: `festgrid-data-ingestion-queue-dlq-${stageName}`,
      removalPolicy,
    });
    const dataIngestionQueue = new sqs.Queue(this, `DataIngestionQueue-${stageName}`, {
      queueName: `festgrid-data-ingestion-queue-${stageName}`,
      deadLetterQueue: {
        queue: dataIngestionDlq,
        maxReceiveCount: 3,
      },
      removalPolicy,
    });

    // 3. Lambda Functions
    const projectRoot = process.cwd().endsWith(path.join('apps', 'infrastructure'))
      ? path.resolve(process.cwd(), '../..')
      : process.cwd();

    const sharedLambdaProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      depsLockFilePath: path.resolve(projectRoot, 'pnpm-lock.yaml'),
      bundling: {
        format: nodejs.OutputFormat.CJS,
      },
    };

    // L_API
    const apiLambda = new nodejs.NodejsFunction(this, `ApiLambda-${stageName}`, {
      entry: path.resolve(projectRoot, 'apps/backend/src/lambdas/api.ts'),
      handler: 'handler',
      ...sharedLambdaProps,
      environment: {
        STAGE: stageName,
        BYOK_KMS_KEY_ID: kmsKey.keyId,
        DATABASE_URL: process.env.DATABASE_URL || '',
        SCRAPING_QUEUE_URL: scrapingQueue.queueUrl,
        GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY || '',
      },
    });

    // L_Scrape
    const scraperLambda = new nodejs.NodejsFunction(this, `ScraperLambda-${stageName}`, {
      entry: path.resolve(projectRoot, 'apps/backend/src/lambdas/scraper.ts'),
      handler: 'handler',
      ...sharedLambdaProps,
      environment: {
        STAGE: stageName,
        DATABASE_URL: process.env.DATABASE_URL || '',
        SCRAPING_QUEUE_URL: scrapingQueue.queueUrl,
        APIFY_API_TOKEN: process.env.APIFY_API_TOKEN || '',
      },
    });

    // L_AI
    const aiProcessorLambda = new nodejs.NodejsFunction(this, `AIProcessorLambda-${stageName}`, {
      entry: path.resolve(projectRoot, 'apps/backend/src/lambdas/ai-processor.ts'),
      handler: 'handler',
      ...sharedLambdaProps,
      environment: {
        STAGE: stageName,
        BYOK_KMS_KEY_ID: kmsKey.keyId,
        DATABASE_URL: process.env.DATABASE_URL || '',
        DATA_INGESTION_QUEUE_URL: dataIngestionQueue.queueUrl,
        GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY || '',
      },
    });

    // L_Ingest
    const ingestorLambda = new nodejs.NodejsFunction(this, `IngestorLambda-${stageName}`, {
      entry: path.resolve(projectRoot, 'apps/backend/src/lambdas/ingestor.ts'),
      handler: 'handler',
      ...sharedLambdaProps,
      environment: {
        STAGE: stageName,
        DATABASE_URL: process.env.DATABASE_URL || '',
      },
    });

    // 4. Trigger Wiring
    // ScrapingQueue -> L_Scrape
    scraperLambda.addEventSource(new eventSources.SqsEventSource(scrapingQueue));

    // EventBridge Schedule -> L_Scrape (seed run)
    const scraperScheduleRule = new events.Rule(this, `ScraperScheduleRule-${stageName}`, {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
    });
    scraperScheduleRule.addTarget(new targets.LambdaFunction(scraperLambda));

    // AIProcessingQueue -> L_AI
    aiProcessorLambda.addEventSource(new eventSources.SqsEventSource(aiProcessingQueue, {
      reportBatchItemFailures: true,
    }));

    // DataIngestionQueue -> L_Ingest
    ingestorLambda.addEventSource(new eventSources.SqsEventSource(dataIngestionQueue, {
      reportBatchItemFailures: true,
    }));

    // 5. IAM Permissions
    // Scraper needs to enqueue onto ScrapingQueue (self-enqueue) & API needs to enqueue for on-demand scrape
    scrapingQueue.grantSendMessages(scraperLambda);
    scrapingQueue.grantSendMessages(apiLambda);

    // AI Processor needs to enqueue onto DataIngestionQueue
    dataIngestionQueue.grantSendMessages(aiProcessorLambda);

    // KMS Encrypt/Decrypt grants only to API Lambda and AI Processor Lambda
    kmsKey.grantEncryptDecrypt(apiLambda);
    kmsKey.grantEncryptDecrypt(aiProcessorLambda);

    // 6. API Gateway Configuration
    const api = new apigateway.RestApi(this, `ApiGateway-${stageName}`, {
      restApiName: `festgrid-api-${stageName}`,
      description: 'API Gateway for FestGrid (FestDaily) backend resolvers',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const graphqlIntegration = new apigateway.LambdaIntegration(apiLambda, {
      proxy: true,
    });

    // ANY on proxy resource {proxy+}
    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', graphqlIntegration);

    // ANY on root
    api.root.addMethod('ANY', graphqlIntegration);

    // Usage Plan with Throttling
    const usagePlan = api.addUsagePlan(`UsagePlan-${stageName}`, {
      name: `festgrid-usage-plan-${stageName}`,
      throttle: {
        rateLimit: 50,
        burstLimit: 100,
      },
    });

    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });

    // Output API Gateway URL
    new cdk.CfnOutput(this, `apiGatewayUrl`, {
      value: api.url,
      description: 'The API Gateway invoke URL',
      exportName: `festgrid-api-url-${stageName}`,
    });
  }
}
