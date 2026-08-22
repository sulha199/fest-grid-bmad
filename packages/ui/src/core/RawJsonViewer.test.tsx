import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RawJsonViewer } from './RawJsonViewer';

describe('RawJsonViewer', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders valid JSON in pretty-printed format', () => {
    const testData = { key: 'value', nested: { count: 42 } };
    const { container } = render(<RawJsonViewer value={testData} />);
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain('key');
    expect(pre?.textContent).toContain('value');
    expect(pre?.textContent).toContain('count');
    expect(pre?.textContent).toContain('42');
  });

  it('handles JSON string input', () => {
    const jsonString = '{"test": "data"}';
    const { container } = render(<RawJsonViewer value={jsonString} />);
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toContain('test');
    expect(pre?.textContent).toContain('data');
  });

  it('falls back to raw string for invalid JSON', () => {
    const invalidJson = 'not valid json {]';
    const { container } = render(<RawJsonViewer value={invalidJson} />);
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toContain('not valid json');
  });

  it('handles null and undefined gracefully', () => {
    const { container, rerender } = render(<RawJsonViewer value={null} />);
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();

    rerender(<RawJsonViewer value={undefined} />);
    expect(container.querySelector('pre')).toBeInTheDocument();
  });

  it('renders with monospace styling', () => {
    const { container } = render(<RawJsonViewer value={{ test: 'data' }} />);
    const pre = container.querySelector('pre');
    expect(pre).toHaveClass('font-mono');
  });

  it('uses the default accessibility label when none is provided', () => {
    render(<RawJsonViewer value={{ test: 'data' }} />);
    expect(screen.getByLabelText('JSON content')).toBeInTheDocument();
  });

  it('uses a custom accessibility label when provided', () => {
    render(<RawJsonViewer value={{ test: 'data' }} label="Raw Output" />);
    expect(screen.getByLabelText('Raw Output')).toBeInTheDocument();
  });

  it('is scrollable for long content', () => {
    const { container } = render(<RawJsonViewer value={{ test: 'data' }} />);
    const scrollContainer = container.querySelector('.overflow-auto');
    expect(scrollContainer).toHaveClass('overflow-auto');
  });
});
