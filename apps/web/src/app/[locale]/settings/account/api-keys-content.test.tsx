import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../../locales/en.json';
import { ApiKeysContent } from './api-keys-content';
import { Toaster } from 'sonner';
import { graphqlClient } from '@/lib/graphql-client';

const mockRouterPush = vi.fn();
const mockPosthogCapture = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

let mockSession: any = { user: { id: 'user-1', email: 'user@test.dev' } };
let mockAuthLoading = false;
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
    isLoading: mockAuthLoading,
  }),
}));

vi.mock('@/lib/graphql-client', () => {
  return {
    graphqlClient: {
      request: vi.fn(),
    },
  };
});

let mockApiKeys = [
  {
    id: 'key-1',
    provider: 'gemini',
    maskedKey: '••••5678',
    isValid: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

let lastDeletedId: string | null = null;
let lastDeletedAction: string | null = null;
let lastCreatedInput: any = null;

beforeAll(() => {
  // Mock posthog globally for the window object
  (window as any).posthog = {
    capture: mockPosthogCapture,
  };
});

beforeEach(() => {
  vi.mocked(graphqlClient.request).mockImplementation(async (arg1: any, arg2: any) => {
    let docStr = '';
    let variables: any = {};
    if (arg1 && typeof arg1 === 'object' && 'document' in arg1) {
      docStr = arg1.document.toString();
      variables = arg1.variables || {};
    } else {
      docStr = arg1 ? arg1.toString() : '';
      variables = arg2 || {};
    }

    console.log('--- DEBUG: MOCKED REQUEST CALLED WITH:', docStr, 'VARIABLES:', variables);
    if (docStr.includes('GetMyApiKeys')) {
      return {
        myApiKeys: mockApiKeys,
      };
    }
    if (docStr.includes('mutation deleteApiKey')) {
      lastDeletedId = variables.id;
      lastDeletedAction = variables.action;
      const keyToUpdate = mockApiKeys.find(k => k.id === variables.id);
      return {
        deleteApiKey: {
          id: variables.id,
          provider: keyToUpdate?.provider || 'gemini',
          maskedKey: keyToUpdate?.maskedKey || '••••5678',
          isValid: variables.action === 'RESTORE',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      };
    }
    if (docStr.includes('mutation CreateApiKey')) {
      lastCreatedInput = variables.input;
      const newKey = {
        id: 'key-new',
        provider: variables.input?.provider || 'gemini',
        maskedKey: '••••' + (variables.input?.key || '1234').slice(-4),
        isValid: true,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      };
      return {
        createApiKey: newKey,
      };
    }
    return {};
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  lastDeletedId = null;
  lastDeletedAction = null;
  lastCreatedInput = null;
  mockApiKeys = [
    {
      id: 'key-1',
      provider: 'gemini',
      maskedKey: '••••5678',
      isValid: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ];
});

afterAll(() => {
  delete (window as any).posthog;
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Toaster />
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('ApiKeysContent', () => {
  it('redirects unauthenticated users to /login', async () => {
    mockSession = null;
    renderWithProviders(<ApiKeysContent />);
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
  });

  it('renders list of API keys correctly', async () => {
    mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
    renderWithProviders(<ApiKeysContent />);

    await waitFor(() => {
      expect(screen.getByText('My API Keys')).toBeInTheDocument();
      expect(screen.getByText('gemini')).toBeInTheDocument();
      expect(screen.getByText('••••5678')).toBeInTheDocument();
    });
  });

  it('allows clicking Revoke button to soft delete a key', async () => {
    mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
    renderWithProviders(<ApiKeysContent />);

    await waitFor(() => {
      expect(screen.getByText('••••5678')).toBeInTheDocument();
    });

    const revokeBtn = screen.getByRole('button', { name: 'Revoke' });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(lastDeletedId).toBe('key-1');
      expect(lastDeletedAction).toBe('DELETE');
      expect(mockPosthogCapture).toHaveBeenCalledWith('api_key_revoked', { provider: 'gemini' });
    });
  });

  it('allows clicking Add API Key to open form, submit, and close dialog', async () => {
    mockSession = { user: { id: 'user-1', email: 'user@test.dev' } };
    renderWithProviders(<ApiKeysContent />);

    await waitFor(() => {
      expect(screen.getByText('My API Keys')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: 'Add API Key' });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add Gemini API Key')).toBeInTheDocument();

    const keyInput = screen.getByLabelText('API Key');
    fireEvent.change(keyInput, { target: { value: 'AIzaSySecretNewKey1234' } });

    const submitBtn = screen.getByRole('button', { name: 'Add Key' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(lastCreatedInput).toEqual({
        provider: 'gemini',
        key: 'AIzaSySecretNewKey1234',
      });
      expect(mockPosthogCapture).toHaveBeenCalledWith('api_key_added', { provider: 'gemini' });
      expect(screen.queryByText('Add Gemini API Key')).not.toBeInTheDocument();
      expect(screen.getByText('••••1234')).toBeInTheDocument();
    });
  });
});
