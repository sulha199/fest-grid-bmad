import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { verifyToken } from './verify-jwt.js';

test('verifyToken', async (t) => {
  // Setup a local test keypair
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  // Add a kid to match verification requirements if any, or just pass it
  jwk.kid = 'test-key-id';
  
  const jwks = createLocalJWKSet({ keys: [jwk] });

  // Generate another keypair to simulate an untrusted key
  const untrustedKeys = await generateKeyPair('ES256');

  await t.test('returns payload for a valid, unexpired token', async () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-id' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const result = await verifyToken(token, jwks);
    assert.deepEqual(result?.sub, 'user-123');
    assert.deepEqual(result?.email, 'test@example.com');
    assert.deepEqual(result?.user_metadata?.name, 'Test User');
  });

  await t.test('returns null for an expired token', async () => {
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-id' })
      .setIssuedAt()
      .setExpirationTime('-1h') // Expired 1 hour ago
      .sign(privateKey);

    const result = await verifyToken(token, jwks);
    assert.equal(result, null);
  });

  await t.test('returns null for a token signed with a different key', async () => {
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-id' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(untrustedKeys.privateKey); // Signed with wrong key

    const result = await verifyToken(token, jwks);
    assert.equal(result, null);
  });

  await t.test('returns null for a malformed token string', async () => {
    const result = await verifyToken('not.a.valid.jwt', jwks);
    assert.equal(result, null);
  });
});
