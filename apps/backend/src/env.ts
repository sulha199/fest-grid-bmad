import * as dotenv from 'dotenv';
import { resolve } from 'path';

export interface BackendEnv {
  port: number;
  supabaseUrl?: string;
  databaseUrl?: string;
  geoapifyApiKey?: string;
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  sesFromEmailAddress?: string;
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
  
  const portStr = process.env.BACKEND_PORT;
  if (!portStr) {
    throw new Error('BACKEND_PORT is not defined in environment variables.');
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    throw new Error('BACKEND_PORT must be a valid number.');
  }

  return { 
    port, 
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    supabaseUrl: process.env.SUPABASE_URL, 
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    databaseUrl: process.env.DATABASE_URL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    geoapifyApiKey: process.env.GEOAPIFY_API_KEY,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    sesFromEmailAddress: process.env.SES_FROM_EMAIL_ADDRESS,
  };
}
