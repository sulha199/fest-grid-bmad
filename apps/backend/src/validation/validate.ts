import Ajv, { Schema } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export function compileValidator<T>(schema: Schema) {
  return ajv.compile<T>(schema);
}
