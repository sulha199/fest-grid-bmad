import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// AD-29 Rule 5 -- no resolver serving a client-facing GraphQL field may ever read
// extraction_audit_logs. A pragmatic source-scan, matching
// events-postid-write-ratchet.test.ts's established precedent: resolvers.ts must contain no
// reference to extractionAuditLogs at all (import or otherwise).
const RESOLVERS_PATH = resolve(process.cwd(), 'src/schema/resolvers.ts');

test('resolvers.ts never references extractionAuditLogs (AD-29 Rule 5)', () => {
  const content = readFileSync(RESOLVERS_PATH, 'utf8');
  assert.ok(
    !content.includes('extractionAuditLogs'),
    'resolvers.ts must never import or reference extractionAuditLogs -- this table is offline/admin-eval-only, never a GraphQL-exposed field (AD-29 Rule 5)'
  );
});
