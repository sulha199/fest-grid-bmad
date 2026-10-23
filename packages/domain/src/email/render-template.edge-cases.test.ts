import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailTemplate } from './render-template.js';
import type { EmailTemplateKey, EmailTemplateVariables } from './types.js';

test('renderEmailTemplate throws for a template key that is not registered', () => {
  assert.throws(
    () =>
      renderEmailTemplate(
        'NOT_A_REAL_TEMPLATE' as EmailTemplateKey,
        {} as EmailTemplateVariables[EmailTemplateKey]
      ),
    /Template with key "NOT_A_REAL_TEMPLATE" not found\./
  );
});
