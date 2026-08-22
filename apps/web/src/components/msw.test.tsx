import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, beforeAll, afterEach, afterAll } from 'vitest';
import { useEffect, useState } from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.example.com/health', () => {
    return HttpResponse.json({ status: 'ok' });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function TestComponent() {
  const [data, setData] = useState<{ status?: string }>({});

  useEffect(() => {
    fetch('https://api.example.com/health')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return <div>Status: {data.status || 'loading'}</div>;
}

test('MSW intercepts fetch requests', async () => {
  render(<TestComponent />);
  expect(screen.getByText('Status: loading')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Status: ok')).toBeInTheDocument();
  });
});
