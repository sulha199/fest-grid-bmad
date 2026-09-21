import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-dynamic-tailwind-arbitrary-value.mjs';

// Wire vitest's describe/it into ESLint's RuleTester (Task 6.5 — AC7's own verification
// requirement: proves the rule fires on the historical bug pattern and does not fire on this
// file family's real, current legitimate usages).
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('no-dynamic-tailwind-arbitrary-value', rule as never, {
  valid: [
    // event-card-media-tokens.ts's own calc() style-value construction (not a Tailwind class).
    '`calc(var(${VAR})*${ratio})`',
    // EventCardMediaPrimitives.tsx's own className concatenation (no arbitrary-value bracket).
    '`flex-1 h-full min-w-0 ${className}`',
    '`relative flex items-center gap-1 px-2.5 py-1 rounded-md ${className}`',
    // A closed arbitrary-value bracket entirely inside the literal text (no interpolation inside it).
    '`w-[1rem] ${className}`',
  ],
  invalid: [
    // The exact historical bug pattern (commit 7bf99260): an interpolated expression sits
    // inside an unclosed Tailwind arbitrary-value bracket.
    {
      code: '`w-[${sizeExpr}] h-[${sizeExpr}]`',
      errors: [{ messageId: 'dynamicArbitraryValue' }, { messageId: 'dynamicArbitraryValue' }],
    },
    {
      code: '`text-[${colorExpr}]`',
      errors: [{ messageId: 'dynamicArbitraryValue' }],
    },
  ],
});
