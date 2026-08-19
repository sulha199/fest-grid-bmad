'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { graphqlClient } from '@/lib/graphql-client';
import { useMeQuery, useUpdateUserTimezoneMutation } from '@/generated/graphql';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { usePostHog } from '@festgrid/analytics';

interface AuthSessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextType | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const posthog = usePostHog();
  const { mutateAsync: updateUserTimezone } = useUpdateUserTimezoneMutation(graphqlClient);

  const captureTimezone = useCallback(async () => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await updateUserTimezone({ timezone });
    } catch (e) {
      console.warn('Timezone capture failed:', e);
    }
  }, [updateUserTimezone]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }: { data: { session: Session | null } }) => {
      setSession(initialSession);
      if (initialSession) {
        graphqlClient.setHeader('Authorization', `Bearer ${initialSession.access_token}`);
        localStorage.setItem('festgrid_has_session', 'true');
        captureTimezone();
      } else {
        graphqlClient.setHeader('Authorization', '');
      }
      setIsLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, currentSession: Session | null) => {
      setSession(currentSession);
      if (currentSession) {
        graphqlClient.setHeader('Authorization', `Bearer ${currentSession.access_token}`);
        captureTimezone();

        if (event === 'SIGNED_IN') {
          // Identify in PostHog
          try {
            if (posthog) {
              posthog.identify(currentSession.user.id);
            }
          } catch (e) {
            console.warn('PostHog identify failed:', e);
          }

          // Check for signup vs login signal
          const hasSessionMarker = localStorage.getItem('festgrid_has_session');
          if (!hasSessionMarker) {
            // First time signing in
            localStorage.setItem('festgrid_has_session', 'true');
            try {
              if (posthog) posthog.capture('user_signed_up');
            } catch (e) {
              console.warn('PostHog capture user_signed_up failed:', e);
            }
          } else {
            // Recurrent sign in
            try {
              if (posthog) posthog.capture('user_logged_in');
            } catch (e) {
              console.warn('PostHog capture user_logged_in failed:', e);
            }
          }
        }
      } else {
        graphqlClient.setHeader('Authorization', '');
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('festgrid_has_session');
        }
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [posthog, captureTimezone]);

  // Set up me query
  const { refetch } = useMeQuery(
    graphqlClient,
    {},
    {
      enabled: !!session,
      retry: false,
    }
  );

  // Re-run query whenever session token changes
  useEffect(() => {
    if (session) {
      refetch();
    }
  }, [session, refetch]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthSessionContext.Provider value={{ session, user: session?.user ?? null, isLoading, signOut }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (context === undefined) {
    throw new Error('useAuthSession must be used within an AuthSessionProvider');
  }
  return context;
}
