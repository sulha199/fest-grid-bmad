import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LogoMark } from './LogoMark';

describe('LogoMark', () => {
  it('renders correctly with default className', () => {
    const { container } = render(<LogoMark />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();
    expect(rootDiv.className).toContain('w-6 h-6');
  });

  it('applies override className correctly', () => {
    const { container } = render(<LogoMark className="w-10 h-10 custom-class" />);
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).toContain('w-10 h-10 custom-class');
    expect(rootDiv.className).not.toContain('w-6 h-6'); // Since default is overridden if className provided
  });
});
