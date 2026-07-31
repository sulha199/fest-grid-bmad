import { render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useEffect, useState } from 'react';

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
