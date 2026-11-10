import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export interface SendSqsMessageOptions {
  /** Seconds the message stays invisible before a consumer can receive it (0 to 900); the pause between steps. */
  delaySeconds?: number;
}

export let sendSqsMessage = async (queueUrl: string, body: string, options?: SendSqsMessageOptions): Promise<void> => {
  const client = new SQSClient({});
  await client.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: body,
    ...(options?.delaySeconds ? { DelaySeconds: Math.min(900, Math.max(0, Math.floor(options.delaySeconds))) } : {}),
  }));
};

export function setSendSqsMessage(fn: typeof sendSqsMessage) {
  sendSqsMessage = fn;
}
