import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface BackendEnv {
  port: number;
  supabaseUrl?: string;
  databaseUrl?: string;
  geoapifyApiKey?: string;
}

export function loadBackendEnv(): BackendEnv {
  // Read relative to this file's position to ensure it finds root .env regardless of process.cwd()
  let resolvedDir = '';
  if (typeof __dirname !== 'undefined') {
    resolvedDir = __dirname;
  } else {
    resolvedDir = resolve(process.cwd(), 'src');
  }

  dotenv.config({ path: resolve(resolvedDir, '../../../.env') });
  dotenv.config({ path: resolve(resolvedDir, '../../.env') });
  // Fallbacks for various cwd environments
  dotenv.config({ path: resolve(process.cwd(), '../../.env') });
  dotenv.config({ path: resolve(process.cwd(), '.env') });
  
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const portStr = process.env.BACKEND_PORT;
  if (!portStr) {
    throw new Error('BACKEND_PORT is not defined in environment variables.');
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    throw new Error('BACKEND_PORT must be a valid number.');
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return { 
    port, 
    supabaseUrl: process.env.SUPABASE_URL, 
    databaseUrl: process.env.DATABASE_URL,
    geoapifyApiKey: process.env.GEOAPIFY_API_KEY
  };
}
