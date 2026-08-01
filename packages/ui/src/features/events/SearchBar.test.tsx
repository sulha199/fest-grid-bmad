import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders input with placeholder and clear button', () => {
    render(
      <SearchBar
        query=""
        onChange={() => {}}
        onSubmit={() => {}}
        placeholder="Search..."
        clearLabel="Clear"
      />
    );

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument(); // Clear button might be hidden when empty
  });

  it('shows clear button when there is text', () => {
    render(
      <SearchBar
        query="festival"
        onChange={() => {}}
        onSubmit={() => {}}
        placeholder="Search..."
        clearLabel="Clear search"
      />
    );

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const handleChange = vi.fn();
    render(
      <SearchBar
        query=""
        onChange={handleChange}
        onSubmit={() => {}}
        placeholder="Search..."
        clearLabel="Clear"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'jazz' } });
    expect(handleChange).toHaveBeenCalledWith('jazz');
  });

  it('calls onSubmit when pressing Enter', () => {
    const handleSubmit = vi.fn();
    render(
      <SearchBar
        query="rock"
        onChange={() => {}}
        onSubmit={handleSubmit}
        placeholder="Search..."
        clearLabel="Clear"
      />
    );

    fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter', code: 'Enter' });
    expect(handleSubmit).toHaveBeenCalledWith('rock');
  });

  it('trims whitespace and treats whitespace-only as empty string on submit', () => {
    const handleSubmit = vi.fn();
    render(
      <SearchBar
        query="   "
        onChange={() => {}}
        onSubmit={handleSubmit}
        placeholder="Search..."
        clearLabel="Clear"
      />
    );

    fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Enter', code: 'Enter' });
    expect(handleSubmit).toHaveBeenCalledWith('');
  });

  it('calls onSubmit with empty string when clear button is clicked', () => {
    const handleSubmit = vi.fn();
    const handleChange = vi.fn();
    render(
      <SearchBar
        query="rock"
        onChange={handleChange}
        onSubmit={handleSubmit}
        placeholder="Search..."
        clearLabel="Clear search"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(handleChange).toHaveBeenCalledWith('');
    expect(handleSubmit).toHaveBeenCalledWith('');
  });
});
