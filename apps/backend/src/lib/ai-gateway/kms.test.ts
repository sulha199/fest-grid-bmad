import test from 'node:test';
import assert from 'node:assert';
import { DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
import {
  decryptApiKey,
  encryptApiKey,
  KmsDecryptionError,
  KmsEncryptionError,
  setKmsClientForTest,
} from './kms.js';

// The KMS code paths are bypassed when NODE_ENV === 'test' (the backend suite's default), so each
// test below switches to a non-test environment with a key configured and restores everything in
// t.after. A fake KMS client stands in for AWS, so nothing here touches the network.
function useKmsEnvironment(t: test.TestContext, options: { allowLegacyBase64?: boolean } = {}) {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    BYOK_KMS_KEY_ID: process.env.BYOK_KMS_KEY_ID,
    BYOK_ALLOW_LEGACY_BASE64_FALLBACK: process.env.BYOK_ALLOW_LEGACY_BASE64_FALLBACK,
  };
  process.env.NODE_ENV = 'development';
  process.env.BYOK_KMS_KEY_ID = 'test-kms-key-id';
  if (options.allowLegacyBase64) {
    process.env.BYOK_ALLOW_LEGACY_BASE64_FALLBACK = 'true';
  } else {
    delete process.env.BYOK_ALLOW_LEGACY_BASE64_FALLBACK;
  }
  t.after(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    setKmsClientForTest(null);
  });
}

const brokenKms = {
  send: async () => {
    throw new Error('simulated KMS outage');
  },
} as never;

test('KMS key handling', async (t) => {
  await t.test('encrypt sends the configured key id to KMS and returns the ciphertext as base64', async (t2) => {
    useKmsEnvironment(t2);
    let seenKeyId: string | undefined;
    setKmsClientForTest({
      send: async (command: unknown) => {
        assert.ok(command instanceof EncryptCommand);
        seenKeyId = command.input.KeyId;
        return { CiphertextBlob: Buffer.from('kms-ciphertext') };
      },
    } as never);

    const stored = await encryptApiKey('AIza-secret-key');

    assert.equal(seenKeyId, 'test-kms-key-id');
    assert.equal(stored, Buffer.from('kms-ciphertext').toString('base64'));
    assert.notEqual(stored, Buffer.from('AIza-secret-key').toString('base64'));
  });

  await t.test('encrypt fails closed: a KMS error throws and the plaintext is never returned as base64', async (t2) => {
    useKmsEnvironment(t2);
    setKmsClientForTest(brokenKms);

    await assert.rejects(() => encryptApiKey('AIza-secret-key'), (error: unknown) => {
      assert.ok(error instanceof KmsEncryptionError);
      assert.ok(!String((error as Error).message).includes('AIza-secret-key'));
      return true;
    });
  });

  await t.test('encrypt fails closed when KMS returns no ciphertext', async (t2) => {
    useKmsEnvironment(t2);
    setKmsClientForTest({ send: async () => ({}) } as never);

    await assert.rejects(() => encryptApiKey('AIza-secret-key'), KmsEncryptionError);
  });

  await t.test('decrypt returns the plaintext KMS produced', async (t2) => {
    useKmsEnvironment(t2);
    setKmsClientForTest({
      send: async (command: unknown) => {
        assert.ok(command instanceof DecryptCommand);
        return { Plaintext: Buffer.from('AIza-secret-key') };
      },
    } as never);

    assert.equal(await decryptApiKey(Buffer.from('kms-ciphertext').toString('base64')), 'AIza-secret-key');
  });

  await t.test('decrypt fails closed by default: a KMS error throws instead of decoding the stored value', async (t2) => {
    useKmsEnvironment(t2);
    setKmsClientForTest(brokenKms);
    const legacyRow = Buffer.from('AIza-secret-key').toString('base64');

    await assert.rejects(() => decryptApiKey(legacyRow), KmsDecryptionError);
  });

  await t.test('decrypt falls back to legacy base64 only when BYOK_ALLOW_LEGACY_BASE64_FALLBACK is on', async (t2) => {
    useKmsEnvironment(t2, { allowLegacyBase64: true });
    setKmsClientForTest(brokenKms);
    const warn = console.warn;
    console.warn = () => {};
    t2.after(() => {
      console.warn = warn;
    });

    assert.equal(await decryptApiKey(Buffer.from('AIza-secret-key').toString('base64')), 'AIza-secret-key');
  });

  await t.test('without a configured key id the local bypass round-trips through base64 and never calls KMS', async (t2) => {
    useKmsEnvironment(t2);
    delete process.env.BYOK_KMS_KEY_ID;
    setKmsClientForTest({
      send: async () => {
        throw new Error('KMS must not be called in the local bypass');
      },
    } as never);

    const stored = await encryptApiKey('AIza-local-dev');

    assert.equal(stored, Buffer.from('AIza-local-dev').toString('base64'));
    assert.equal(await decryptApiKey(stored), 'AIza-local-dev');
  });

  await t.test('the NODE_ENV=test bypass never calls KMS even when a key id is set', async (t2) => {
    useKmsEnvironment(t2);
    process.env.NODE_ENV = 'test';
    setKmsClientForTest({
      send: async () => {
        throw new Error('KMS must not be called under NODE_ENV=test');
      },
    } as never);

    const stored = await encryptApiKey('AIza-test');

    assert.equal(await decryptApiKey(stored), 'AIza-test');
  });
});
