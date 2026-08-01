import { GraphQLError } from 'graphql';
import { verifySupabaseJwt } from './verify-jwt.js';
import { getOrCreateUser } from './user-provisioning.js';

// Exposed for testing to allow dependency injection
export const __deps = {
  verifySupabaseJwt,
  getOrCreateUser,
};

export type AuthenticatedUser = {
  userId: string;
  role: 'user' | 'moderator';
};

export type GraphQLContext = {
  user: AuthenticatedUser | null;
};

export async function createContext({ request }: { request: Request }): Promise<GraphQLContext> {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return { user: null };
  }

  const payload = await __deps.verifySupabaseJwt(token);
  if (!payload) {
    return { user: null };
  }

  const user = await __deps.getOrCreateUser(payload);
  
  return {
    user: {
      userId: user.id,
      role: user.role,
    },
  };
}

export function requireAuth(context: GraphQLContext): AuthenticatedUser {
  if (!context.user) {
    throw new GraphQLError('You must be logged in to perform this action.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

export function requireModerator(context: GraphQLContext): AuthenticatedUser {
  const user = requireAuth(context);
  if (user.role !== 'moderator') {
    throw new GraphQLError('You must be a moderator to perform this action.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}
