import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { useMeQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export type RequireModeratorStatus = 'loading' | 'unauthenticated' | 'unauthorized' | 'authorized';

export function useRequireModerator() {
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuthSession();

  const { data, status: meQueryStatus } = useMeQuery(
    graphqlClient,
    undefined,
    {
      enabled: !!session && !isAuthLoading,
    }
  );

  let status: RequireModeratorStatus = 'loading';

  if (isAuthLoading) {
    status = 'loading';
  } else if (!session) {
    status = 'unauthenticated';
  } else if (meQueryStatus === 'pending') {
    status = 'loading';
  } else if (meQueryStatus === 'error') {
    status = 'unauthorized';
  } else if (data?.me?.role === 'moderator') {
    status = 'authorized';
  } else {
    status = 'unauthorized';
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'unauthorized') {
      router.push('/');
    }
  }, [status, router]);

  return { status };
}
