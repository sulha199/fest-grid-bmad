import { SESv2Client } from '@aws-sdk/client-sesv2';

let sesClient: SESv2Client | null = null;

export function getSesClient(): SESv2Client {
  if (sesClient) {
    return sesClient;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  sesClient = new SESv2Client({ region });
  return sesClient;
}

export function setSesClient(client: SESv2Client | null): void {
  sesClient = client;
}
