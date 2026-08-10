import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export let sendSqsMessage = async (queueUrl: string, body: string): Promise<void> => {
  const client = new SQSClient({});
  await client.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: body,
  }));
};

export function setSendSqsMessage(fn: typeof sendSqsMessage) {
  sendSqsMessage = fn;
}
