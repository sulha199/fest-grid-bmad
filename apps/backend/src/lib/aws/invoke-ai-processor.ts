import type { ManualExtractionInvokePayload } from '@festgrid/domain/posts';

// Story 4.2b -- fire-and-forget (InvocationType 'Event') invoke of the AI Lambda from the API
// Lambda, used for manual "AI-Assisted Correction" extraction. Same reassignable-function /
// setter test-seam convention as send-sqs-message.ts. The SDK client is imported lazily so no
// other API-Lambda path pays for it at cold start.
export let invokeAiProcessor = async (functionName: string, payload: ManualExtractionInvokePayload): Promise<void> => {
  const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
  const client = new LambdaClient({});
  const response = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  );
  // An async invoke is accepted with 202; anything else means it was not queued.
  if (response.StatusCode !== 202) {
    throw new Error(`Async invoke of ${functionName} was not accepted (status ${response.StatusCode})`);
  }
};

export function setInvokeAiProcessor(fn: typeof invokeAiProcessor) {
  invokeAiProcessor = fn;
}
