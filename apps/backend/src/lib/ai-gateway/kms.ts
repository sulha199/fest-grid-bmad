import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
import { loadBackendEnv } from '../../env.js';

// BYOK API keys are encrypted with AWS KMS before they are stored. This module fails CLOSED:
// when a KMS key is configured and KMS cannot encrypt or decrypt, it throws instead of quietly
// storing or accepting a plaintext-equivalent value.
//
// Earlier versions fell back to base64 on any KMS error. On encrypt that stored the plaintext key
// as plain base64 behind a console warning, so a KMS outage or a missing IAM grant silently
// turned encryption off. The only remaining non-KMS path is the explicit local/test bypass below
// (no BYOK_KMS_KEY_ID configured, or NODE_ENV === 'test'), and a temporary, opt-in decrypt
// fallback for rows an older build stored as base64 (BYOK_ALLOW_LEGACY_BASE64_FALLBACK=true).

export class KmsEncryptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'KmsEncryptionError';
  }
}

export class KmsDecryptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'KmsDecryptionError';
  }
}

let kmsClient: Pick<KMSClient, 'send'> | null = null;

export function getKmsClient(): Pick<KMSClient, 'send'> {
  if (!kmsClient) {
    kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return kmsClient;
}

// Test seam (same let + setter pattern as elsewhere in this codebase): lets unit tests supply a
// fake KMS client without mocking the AWS SDK module. Pass null to restore the real client.
export function setKmsClientForTest(client: Pick<KMSClient, 'send'> | null) {
  kmsClient = client;
}

// The local/test bypass: no KMS key configured (local development) or the test environment.
function isKmsBypassed(byokKmsKeyId: string | undefined): boolean {
  return !byokKmsKeyId || process.env.NODE_ENV === 'test';
}

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

export let decryptApiKey = async (ciphertextBase64: string): Promise<string> => {
  const env = loadBackendEnv();

  if (isKmsBypassed(env.byokKmsKeyId)) {
    return decodeBase64Fallback(ciphertextBase64);
  }

  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertextBase64, 'base64'),
  });
  try {
    const response = await getKmsClient().send(command);
    if (!response.Plaintext) {
      throw new Error('KMS Decrypt returned empty plaintext');
    }
    return Buffer.from(response.Plaintext).toString('utf-8');
  } catch (error) {
    if (env.byokAllowLegacyBase64Fallback) {
      console.warn('KMS Decrypt failed; BYOK_ALLOW_LEGACY_BASE64_FALLBACK is on, decoding the stored value as legacy base64:', error);
      return decodeBase64Fallback(ciphertextBase64);
    }
    throw new KmsDecryptionError('Failed to decrypt the stored API key with KMS.', error);
  }
};

export function setDecryptApiKey(fn: typeof decryptApiKey) {
  decryptApiKey = fn;
}

export let encryptApiKey = async (plaintext: string): Promise<string> => {
  const env = loadBackendEnv();
  if (isKmsBypassed(env.byokKmsKeyId)) {
    return Buffer.from(plaintext).toString('base64');
  }

  const command = new EncryptCommand({
    KeyId: env.byokKmsKeyId,
    Plaintext: Buffer.from(plaintext),
  });
  try {
    const response = await getKmsClient().send(command);
    if (!response.CiphertextBlob) {
      throw new Error('KMS Encrypt returned empty ciphertext');
    }
    return Buffer.from(response.CiphertextBlob).toString('base64');
  } catch (error) {
    // Never fall back to base64 here: that would store the key unencrypted.
    throw new KmsEncryptionError('Failed to encrypt the API key with KMS.', error);
  }
};

export function setEncryptApiKey(fn: typeof encryptApiKey) {
  encryptApiKey = fn;
}
