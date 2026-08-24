import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GridContainer } from './grid-container';

describe('GridContainer', () => {
  it('renders children correctly', () => {
    render(
      <GridContainer>
        <span data-testid="grid-child">Item 1</span>
      </GridContainer>
    );

    const child = screen.getByTestId('grid-child');
    expect(child).toBeInTheDocument();
    expect(child.textContent).toBe('Item 1');
  });

  it('renders standard card grid with default props (baseCols=1, colsStep=1, gap-4)', () => {
    const { container } = render(
      <GridContainer>
        <div>Item 1</div>
      </GridContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();

    const expectedClasses = [
      'grid',
      'gap-4',
      'grid-cols-1',
      'md:grid-cols-2',
      'lg:grid-cols-3',
      'xl:grid-cols-4',
      '2xl:grid-cols-5',
    ];

    expectedClasses.forEach((cls) => {
      expect(rootDiv.className).toContain(cls);
    });
  });

  it('renders masonry/Pinterest grid when passed baseCols=2, colsStep=1', () => {
    const { container } = render(
      <GridContainer baseCols={2} colsStep={1}>
        <div>Item 1</div>
      </GridContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();

    const expectedClasses = [
      'grid',
      'gap-4',
      'grid-cols-2',
      'md:grid-cols-3',
      'lg:grid-cols-4',
      'xl:grid-cols-5',
      '2xl:grid-cols-6',
    ];

    expectedClasses.forEach((cls) => {
      expect(rootDiv.className).toContain(cls);
    });
  });

  it('applies custom gap classes and removes default gap classes', () => {
    const { container } = render(
      <GridContainer gap="gap-6">
        <div>Item 1</div>
      </GridContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();

    expect(rootDiv.className).toContain('gap-6');
    expect(rootDiv.className).not.toContain('gap-4');
  });

  it('merges an additional className prop without losing base grid and breakpoint classes', () => {
    const { container } = render(
      <GridContainer className="custom-grid-class bg-muted">
        <div>Item 1</div>
      </GridContainer>
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv).toBeInTheDocument();

    // Verify custom classes
    expect(rootDiv.className).toContain('custom-grid-class');
    expect(rootDiv.className).toContain('bg-muted');

    // Verify default layout classes are still present
    expect(rootDiv.className).toContain('grid');
    expect(rootDiv.className).toContain('gap-4');
    expect(rootDiv.className).toContain('grid-cols-1');
    expect(rootDiv.className).toContain('2xl:grid-cols-5');
  });

  it('throws a descriptive error at render time if column count exceeds 8 at any breakpoint', () => {
    // Suppress console.error output from Vitest output for expected error throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <GridContainer baseCols={5} colsStep={2}>
          <div>Item 1</div>
        </GridContainer>
      );
    }).toThrow(
      "GridContainer: Column count 9 at breakpoint 'lg' is out of the supported range (1-8). baseCols: 5, colsStep: 2"
    );

    consoleSpy.mockRestore();
  });

  it('throws a descriptive error at render time if column count is less than 1 at any breakpoint', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <GridContainer baseCols={0} colsStep={0}>
          <div>Item 1</div>
        </GridContainer>
      );
    }).toThrow(
      "GridContainer: Column count 0 at breakpoint 'base' is out of the supported range (1-8). baseCols: 0, colsStep: 0"
    );

    consoleSpy.mockRestore();
  });
});
