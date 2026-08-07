import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
import { loadBackendEnv } from '../../env.js';

let kmsClient: KMSClient | null = null;

export function getKmsClient(): KMSClient {
  if (!kmsClient) {
    const env = loadBackendEnv();
    kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return kmsClient;
}

export let decryptApiKey = async (ciphertextBase64: string): Promise<string> => {
  const env = loadBackendEnv();
  // Local/test mock bypass if key is not set or in test mode
  if (!env.byokKmsKeyId || process.env.NODE_ENV === 'test') {
    try {
      return Buffer.from(ciphertextBase64, 'base64').toString('utf-8');
    } catch {
      return ciphertextBase64;
    }
  }

  const client = getKmsClient();
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertextBase64, 'base64'),
  });
  const response = await client.send(command);
  if (!response.Plaintext) {
    throw new Error('KMS Decrypt returned empty plaintext');
  }
  return Buffer.from(response.Plaintext).toString('utf-8');
};

export function setDecryptApiKey(fn: typeof decryptApiKey) {
  decryptApiKey = fn;
}

export let encryptApiKey = async (plaintext: string): Promise<string> => {
  const env = loadBackendEnv();
  if (!env.byokKmsKeyId || process.env.NODE_ENV === 'test') {
    return Buffer.from(plaintext).toString('base64');
  }

  const client = getKmsClient();
  const command = new EncryptCommand({
    KeyId: env.byokKmsKeyId,
    Plaintext: Buffer.from(plaintext),
  });
  const response = await client.send(command);
  if (!response.CiphertextBlob) {
    throw new Error('KMS Encrypt returned empty ciphertext');
  }
  return Buffer.from(response.CiphertextBlob).toString('base64');
};

export function setEncryptApiKey(fn: typeof encryptApiKey) {
  encryptApiKey = fn;
}
