import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, type Message } from '@aws-sdk/client-sqs';

// Follows the exact same reassignable-function/setter test-seam convention already
// established by send-sqs-message.ts's sendSqsMessage/setSendSqsMessage.
export let receiveSqsMessages = async (queueUrl: string): Promise<Message[]> => {
  const client = new SQSClient({});
  const result = await client.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
  }));
  return result.Messages ?? [];
};

export function setReceiveSqsMessages(fn: typeof receiveSqsMessages) {
  receiveSqsMessages = fn;
}

export let deleteSqsMessage = async (queueUrl: string, receiptHandle: string): Promise<void> => {
  const client = new SQSClient({});
  await client.send(new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  }));
};

export function setDeleteSqsMessage(fn: typeof deleteSqsMessage) {
  deleteSqsMessage = fn;
}

// 300s Lambda timeout minus a 30s safety margin, so the loop never gets killed mid-receive
// by the platform's own hard timeout.
const DEFAULT_TIME_BUDGET_MS = 270_000;

export interface PollAndDrainQueueOptions {
  timeBudgetMs?: number;
}

/**
 * Repeatedly receives and processes messages from an SQS queue until either a receive
 * call returns zero messages (queue drained) or the time budget is reached, rather than
 * processing a single fixed batch per invocation. A message is only deleted after
 * `handleMessage` resolves without throwing -- a thrown error is logged and the message is
 * left undeleted so the queue's own maxReceiveCount redrive-to-DLQ policy still applies.
 */
export async function pollAndDrainQueue(
  queueUrl: string,
  handleMessage: (body: string) => Promise<void>,
  opts: PollAndDrainQueueOptions = {}
): Promise<void> {
  const timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const deadline = Date.now() + timeBudgetMs;

  // The first receive always happens regardless of the time budget so a single short-lived
  // invocation still does useful work; the budget only governs whether the loop continues
  // past the batch it is currently processing.
  for (;;) {
    const messages = await receiveSqsMessages(queueUrl);
    if (messages.length === 0) {
      return;
    }

    for (const message of messages) {
      if (!message.Body || !message.ReceiptHandle) {
        continue;
      }
      try {
        await handleMessage(message.Body);
        await deleteSqsMessage(queueUrl, message.ReceiptHandle);
      } catch (error) {
        console.error('pollAndDrainQueue: failed to process message, leaving it undeleted', error);
      }
    }

    if (Date.now() >= deadline) {
      return;
    }
  }
}
