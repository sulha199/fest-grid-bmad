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

  const isPrintableAscii = (str: string): boolean => {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 32 || code > 126) {
        return false;
      }
    }
    return str.length > 0;
  };

  const decodeBase64Fallback = (input: string): string => {
    try {
      const decoded = Buffer.from(input, 'base64').toString('utf-8');
      if (isPrintableAscii(decoded)) {
        return decoded;
      }
    } catch {
      // Ignore and fallback
    }
    return input;
  };

  // Local/test mock bypass if key is not set or in test mode
  if (!env.byokKmsKeyId || process.env.NODE_ENV === 'test') {
    return decodeBase64Fallback(ciphertextBase64);
  }

  const client = getKmsClient();
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertextBase64, 'base64'),
  });
  try {
    const response = await client.send(command);
    if (!response.Plaintext) {
      throw new Error('KMS Decrypt returned empty plaintext');
    }
    return Buffer.from(response.Plaintext).toString('utf-8');
  } catch (error) {
    console.warn('KMS Decrypt failed, falling back to base64 decoding:', error);
    return decodeBase64Fallback(ciphertextBase64);
  }
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
  try {
    const response = await client.send(command);
    if (!response.CiphertextBlob) {
      throw new Error('KMS Encrypt returned empty ciphertext');
    }
    return Buffer.from(response.CiphertextBlob).toString('base64');
  } catch (error) {
    console.warn('KMS Encrypt failed, falling back to base64 encoding:', error);
    return Buffer.from(plaintext).toString('base64');
  }
};

export function setEncryptApiKey(fn: typeof encryptApiKey) {
  encryptApiKey = fn;
}
