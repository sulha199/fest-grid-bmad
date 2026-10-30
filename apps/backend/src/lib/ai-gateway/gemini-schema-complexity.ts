export interface GeminiSchemaComplexity {
  /** Every `enum` member counted at every place it appears (an enum repeated 7 times counts 7x). */
  enumValues: number;
  /** Every schema node (OBJECT / ARRAY / scalar), counted wherever it appears. */
  nodes: number;
  /** `JSON.stringify(schema).length`. */
  serializedChars: number;
}

/**
 * Size of a Gemini `responseSchema` as the API sees it. Gemini rejects a schema it considers too
 * complex with a bare `400 INVALID_ARGUMENT` ("Request contains an invalid argument"), and that
 * limit depends on the expanded size, not on how many enum types the code declares: the filter
 * schema unrolls one leaf definition into 7 node copies, so growing one enum by N values adds 7N.
 * Nothing offline can ask Gemini, so the budget tests in this codebase pin this measure instead.
 */
export function measureGeminiSchemaComplexity(schema: unknown): GeminiSchemaComplexity {
  let enumValues = 0;
  let nodes = 0;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.type === 'string') nodes++;
    if (Array.isArray(record.enum)) enumValues += record.enum.length;
    for (const [key, value] of Object.entries(record)) {
      // An `enum` keyword is an array of values; a *property* named "enum" holds a schema object.
      if (!(key === 'enum' && Array.isArray(value))) visit(value);
    }
  };
  visit(schema);
  return { enumValues, nodes, serializedChars: JSON.stringify(schema).length };
}
