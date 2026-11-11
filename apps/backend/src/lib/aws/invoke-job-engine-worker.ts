// Story 10.1a -- fire-and-forget (InvocationType 'Event') invoke of a job-engine worker: API -> Scraper or AI-processor
// to start a job, and Scraper -> AI-processor for a cross-Lambda phase hand-off (AD-53). The payload is ALWAYS just
// `{ jobId }`: the receiving Lambda reloads the job row and resumes from its stored phase, never from a vendor token,
// a caption or a phase carried in the message (AD-41 Rule 2: the payload is a hint, the worker decides from the
// database). Same reassignable-function / setter test seam and lazy SDK import as invoke-ai-processor.ts.
export type JobEngineInvokePayload = { jobType: 'job-engine-run'; jobId: string };

export let invokeJobEngineWorker = async (functionName: string, payload: { jobId: string }): Promise<void> => {
  const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
  const client = new LambdaClient({});
  const body: JobEngineInvokePayload = { jobType: 'job-engine-run', jobId: payload.jobId };
  const response = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(body)),
    })
  );
  // An async invoke is accepted with 202; anything else means it was not queued.
  if (response.StatusCode !== 202) {
    throw new Error(`Async invoke of ${functionName} was not accepted (status ${response.StatusCode})`);
  }
};

export function setInvokeJobEngineWorker(fn: typeof invokeJobEngineWorker) {
  invokeJobEngineWorker = fn;
}
