import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageContainer } from './page-container';

describe('PageContainer', () => {
  it('renders children correctly', () => {
    render(
      <PageContainer>
        <span data-testid="child-element">Hello World</span>
      </PageContainer>
    );

    const child = screen.getByTestId('child-element');
    expect(child).toBeInTheDocument();
    expect(child.textContent).toBe('Hello World');
  });

  it('contains the base class names from the design system when fullWidth is default/true', () => {
    const { container } = render(
      <PageContainer>
        <div>Content</div>
      </PageContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();
    
    // Base class names to verify
    const baseClasses = [
      'w-full',
      'min-w-[320px]',
      'sm:min-w-[640px]',
      'md:min-w-[768px]',
      'lg:min-w-[1024px]',
      'xl:min-w-[1280px]',
      'p-4',
      'sm:p-8',
      'space-y-8'
    ];

    baseClasses.forEach((cls) => {
      expect(rootDiv.className).toContain(cls);
    });
    expect(rootDiv.className).not.toContain('max-w-5xl');
    expect(rootDiv.className).not.toContain('mx-auto');
  });

  it('contains the contained class names when fullWidth is false', () => {
    const { container } = render(
      <PageContainer fullWidth={false}>
        <div>Content</div>
      </PageContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();
    
    const containedClasses = [
      'w-full',
      'max-w-5xl',
      'mx-auto',
      'lg:min-w-[768px]',
      'p-4',
      'sm:p-8',
      'space-y-8'
    ];

    containedClasses.forEach((cls) => {
      expect(rootDiv.className).toContain(cls);
    });

    // Should NOT contain xl:min-w-[1280px]
    expect(rootDiv.className).not.toContain('xl:min-w-[1280px]');
  });

  it('merges an additional className prop without losing base classes when fullWidth is true', () => {
    const { container } = render(
      <PageContainer className="custom-class bg-slate-100">
        <div>Content</div>
      </PageContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();

    // Verify custom classes are present
    expect(rootDiv.className).toContain('custom-class');
    expect(rootDiv.className).toContain('bg-slate-100');

    // Verify base classes are also present
    expect(rootDiv.className).toContain('w-full');
    expect(rootDiv.className).toContain('p-4');
    expect(rootDiv.className).toContain('space-y-8');
  });

  it('merges an additional className prop without losing contained classes when fullWidth is false', () => {
    const { container } = render(
      <PageContainer fullWidth={false} className="custom-class bg-slate-100">
        <div>Content</div>
      </PageContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();

    // Verify custom classes are present
    expect(rootDiv.className).toContain('custom-class');
    expect(rootDiv.className).toContain('bg-slate-100');

    // Verify contained classes are also present
    expect(rootDiv.className).toContain('w-full');
    expect(rootDiv.className).toContain('max-w-5xl');
    expect(rootDiv.className).toContain('mx-auto');
    expect(rootDiv.className).toContain('lg:min-w-[768px]');
  });
});

