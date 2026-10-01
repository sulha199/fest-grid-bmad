import { afterEach, describe, expect, it, vi } from 'vitest';
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

  // ── Story 0.45 / Architecture Spine AD-27 — layout="masonry" (AC1/AC3/AC4/AC11) ──────────
  describe('layout="masonry"', () => {
    const setInnerWidth = (width: number) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
    };

    afterEach(() => {
      setInnerWidth(1024);
    });

    it('AC1 — defaults to css-grid when layout is omitted (unaffected by this story)', () => {
      const { container } = render(
        <GridContainer baseCols={1} colsStep={1}>
          <div>Item 1</div>
        </GridContainer>
      );
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv.className).toContain('grid');
      expect(rootDiv).not.toHaveAttribute('data-grid-container-layout');
    });

    it('AC3/AC4 — renders one equal-width flex column track per active breakpoint column count, not CSS Grid classes', () => {
      setInnerWidth(768); // md breakpoint
      const { container } = render(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </GridContainer>
      );

      const root = container.firstChild as HTMLElement;
      expect(root).toHaveAttribute('data-grid-container-layout', 'masonry');
      expect(root.className).not.toContain('grid-cols');

      // baseCols=2, colsStep=1 -> md = 2 + 1*1 = 3 columns (DESIGN.md's documented table, AC3).
      const columns = container.querySelectorAll('[data-grid-container-column]');
      expect(columns).toHaveLength(3);
      columns.forEach((col) => {
        expect(col).toHaveClass('flex-1');
        expect(col).toHaveClass('min-w-0');
      });
    });

    it('AC4/AC9 — renders every item exactly once, indexed for placement-order verification', () => {
      // useMasonryLayout's own dedicated unit tests (useMasonryLayout.test.ts, AC11) exercise the
      // round-robin-vs-shortest-column placement logic itself under controlled heights; jsdom's
      // real refs all measure offsetHeight 0 (no layout engine), so this component-level test
      // asserts the WIRING (every item renders exactly once, carrying its original index) rather
      // than which column a 0-height jsdom node lands in (see EventCard.tsx's Task 2.3 comment
      // for this codebase's established "assert the mechanism, not jsdom pixels" convention).
      setInnerWidth(1536); // 2xl breakpoint
      const { container } = render(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          <div key="a">A</div>
          <div key="b">B</div>
          <div key="c">C</div>
        </GridContainer>
      );

      const items = Array.from(container.querySelectorAll('[data-grid-container-item]'));
      expect(items).toHaveLength(3);
      expect(items.map((el) => el.getAttribute('data-grid-container-item-index')).sort()).toEqual(['0', '1', '2']);
      expect(items.map((el) => el.textContent).sort()).toEqual(['A', 'B', 'C']);
    });

    it('AC1 — preserves the existing per-breakpoint out-of-range validation for masonry too', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        render(
          <GridContainer baseCols={5} colsStep={2} layout="masonry">
            <div>Item 1</div>
          </GridContainer>
        );
      }).toThrow(/Column count 9 at breakpoint 'lg'/);
      consoleSpy.mockRestore();
    });

    it('translates the gap prop onto both the row (inter-column) and each column (inter-item) track', () => {
      const { container } = render(
        <GridContainer layout="masonry" gap="gap-x-2 gap-y-6">
          <div>Item 1</div>
        </GridContainer>
      );
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain('gap-x-2');
      expect(root.className).toContain('gap-y-6');
      const column = container.querySelector('[data-grid-container-column]') as HTMLElement;
      expect(column.className).toContain('gap-x-2');
      expect(column.className).toContain('gap-y-6');
    });
  });
});
