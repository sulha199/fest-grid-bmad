'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GoogleLoginButton, BlockingLoader } from '@festgrid/ui';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function LoginContent() {
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLocalError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setLocalError(error.message);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Sign-in with Google error:', err);
      setLocalError(err?.message || 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  const hasError = errorParam === 'auth_failed' || localError;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 sm:px-6 lg:px-8">
      <BlockingLoader active={isLoading} label={t('loading')} />

      <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-zinc-50 tracking-tight">
            {t('heading')}
          </h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
            {t('copy')}
          </p>
        </div>

        {hasError && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400 role-alert">
            {localError ? localError : t('authFailedError')}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <GoogleLoginButton onClick={handleGoogleLogin} disabled={isLoading}>
            {t('googleButtonLabel')}
          </GoogleLoginButton>
        </div>
      </div>
    </div>
  );
}
