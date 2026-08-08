import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { randomUUID } from 'node:crypto';
import { getSesClient } from './ses-client.js';
import { loadBackendEnv } from '../../env.js';
import {
  EmailTemplateKey,
  EmailTemplateVariables,
  renderEmailTemplate,
} from '@festgrid/domain';

export async function sendTemplatedEmail<K extends EmailTemplateKey>(
  templateKey: K,
  to: string,
  variables: EmailTemplateVariables[K]
): Promise<string> {
  const env = loadBackendEnv();
  const fromEmail = env.sesFromEmailAddress;

  if (!fromEmail || process.env.NODE_ENV === 'test') {
    const { subject, text } = renderEmailTemplate(templateKey, variables);
    const stubMessageId = `local-dev-${randomUUID()}`;
    console.info(
      `[Email Stub] Outbound email sending bypassed.\n` +
      `Reason: ${!fromEmail ? 'SES_FROM_EMAIL_ADDRESS is unset' : 'NODE_ENV is test'}\n` +
      `To: ${to}\n` +
      `Template: ${templateKey}\n` +
      `Subject: ${subject}\n` +
      `Body:\n${text}`
    );
    return stubMessageId;
  }

  const { subject, html, text } = renderEmailTemplate(templateKey, variables);

  const client = getSesClient();
  const command = new SendEmailCommand({
    FromEmailAddress: fromEmail,
    Destination: {
      ToAddresses: [to],
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject,
        },
        Body: {
          Html: {
            Data: html,
          },
          Text: {
            Data: text,
          },
        },
      },
    },
  });

  const response = await client.send(command);
  if (!response.MessageId) {
    throw new Error('SES did not return a MessageId after successfully sending email.');
  }

  return response.MessageId;
}
