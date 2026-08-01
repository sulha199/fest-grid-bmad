import { jwtVerify, JWTVerifyGetKey } from 'jose';
import { getRemoteJwks } from './jwks.js';

export type SupabaseJwtPayload = {
  sub: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
  };
};

export async function verifyToken(
  token: string,
  jwks: JWTVerifyGetKey
): Promise<SupabaseJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwks);
    return payload as SupabaseJwtPayload;
  } catch {
    // Return null on any jose verification error
    return null;
  }
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload | null> {
  const jwks = getRemoteJwks();
  return verifyToken(token, jwks);
}
