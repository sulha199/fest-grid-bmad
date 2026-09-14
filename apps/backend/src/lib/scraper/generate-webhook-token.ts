import { randomBytes } from 'node:crypto';

/**
 * Generates a cryptographically-secure webhook token (48 hex chars) that acts
 * as the sole secret gating which caller can complete a pending scrape job via
 * the public, unauthenticated /webhooks/* endpoints. Must stay
 * crypto-secure — a predictable (Math.random()-based) token would let an
 * attacker spoof completion for jobs they don't own.
 */
export function generateWebhookToken(): string {
  return randomBytes(24).toString('hex');
}
