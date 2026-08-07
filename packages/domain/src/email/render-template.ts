import { EMAIL_TEMPLATES } from './templates.js';
import { EmailTemplateKey, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderEmailTemplate<K extends EmailTemplateKey>(
  templateKey: K,
  variables: EmailTemplateVariables[K]
): RenderedEmail {
  const template = EMAIL_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Template with key "${templateKey}" not found.`);
  }

  const vars = variables as Record<string, unknown>;

  const render = (content: string): string => {
    const placeholderRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const missingKeys: string[] = [];
    
    let match;
    placeholderRegex.lastIndex = 0;
    while ((match = placeholderRegex.exec(content)) !== null) {
      const key = match[1];
      if (vars[key] === undefined) {
        missingKeys.push(key);
      }
    }
    
    if (missingKeys.length > 0) {
      throw new Error(
        `Missing required template variables for "${templateKey}": ${Array.from(new Set(missingKeys)).join(', ')}`
      );
    }

    return content.replace(placeholderRegex, (_, key) => {
      return String(vars[key]);
    });
  };

  const subject = render(template.subject);
  const html = render(template.html);
  const text = render(template.text);

  return {
    subject,
    html,
    text,
  };
}
