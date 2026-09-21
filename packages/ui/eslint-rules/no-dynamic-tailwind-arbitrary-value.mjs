/**
 * no-dynamic-tailwind-arbitrary-value (Story 1.i1k AC7, FIND-025 finding (2))
 *
 * Flags a template literal whose text immediately before an interpolated expression ends
 * with an unclosed Tailwind arbitrary-value bracket (e.g. `` `w-[${sizeExpr}]` ``). Tailwind's
 * build-time content scanner only picks up class-name candidates that appear as complete
 * literal strings in source — a class assembled via runtime template-literal interpolation is
 * invisible to it and generates no CSS at all (the exact root cause of the dead-CSS bug fixed
 * in commit `7bf99260`, see `event-card-media-tokens.ts`'s own docstring).
 *
 * Does NOT flag ordinary template-literal usages in this file family, e.g.
 * `` `calc(var(${VAR})*${ratio})` `` (no Tailwind utility-prefix bracket) or
 * `` `flex-1 h-full min-w-0 ${className}` `` (interpolation is not inside/after an open bracket).
 */
const UNCLOSED_ARBITRARY_VALUE = /-\[[^[\]]*$/;

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a dynamically-interpolated Tailwind arbitrary-value class (e.g. `w-[${expr}]`), which Tailwind\'s static content scanner cannot see and silently generates no CSS.',
    },
    schema: [],
    messages: {
      dynamicArbitraryValue:
        'Dynamically-interpolated Tailwind arbitrary-value class detected (e.g. `w-[${expr}]`). Tailwind\'s build-time scanner cannot see runtime-interpolated class names, so no CSS is generated. Use an inline `style` object instead (see event-card-media-tokens.ts).',
    },
  },
  create(context) {
    return {
      TemplateLiteral(node) {
        const { quasis } = node;
        for (let i = 0; i < quasis.length - 1; i++) {
          if (UNCLOSED_ARBITRARY_VALUE.test(quasis[i].value.raw)) {
            context.report({ node: quasis[i], messageId: 'dynamicArbitraryValue' });
          }
        }
      },
    };
  },
};
