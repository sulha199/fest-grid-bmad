import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
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
      vi.restoreAllMocks();
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

    it('AC1/AC9 — renders one flat parent (no per-column wrapper), with per-breakpoint column count reflected via gridTemplateColumns, not CSS Grid utility classes', () => {
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
      expect(root.style.display).toBe('grid');
      // baseCols=2, colsStep=1 -> md = 2 + 1*1 = 3 columns (DESIGN.md's documented table, AC5).
      expect(root.style.gridTemplateColumns).toBe('repeat(3, 1fr)');

      // AC1: no per-column wrapper `<div>` exists — every item is a DIRECT child of the one flat
      // parent, each carrying its own column-index attribute instead.
      expect(container.querySelectorAll('[data-grid-container-column]')).toHaveLength(0);
      const items = container.querySelectorAll('[data-grid-container-item]');
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.parentElement).toBe(root);
        expect(item.hasAttribute('data-grid-container-column-index')).toBe(true);
      });
    });

    it('AC2 — Phase 1 (unmeasured, SSR/first-paint): each item gets inline gridColumn + gridRow:auto, no explicit container height or position', () => {
      // jsdom's ref-callback-during-commit timing means `hasMeasured` is already true the moment
      // a real `render()` call returns (even a jsdom `offsetHeight` of 0 counts as "known" --
      // see useMasonryLayout's own doc comment) -- there is no way to observe the pre-measurement
      // Phase 1 state via a hydrated jsdom render. Phase 1 is, by construction, only genuinely
      // observable in the SSR/no-hydration state (exactly what `packages/visual-audit`'s
      // `grid-container-masonry.ts` manifest exercises via `renderToStaticMarkup`, per that
      // file's own header) -- so this test uses the same mechanism directly.
      const html = renderToStaticMarkup(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </GridContainer>
      );

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const root = doc.querySelector('[data-grid-container-layout="masonry"]') as HTMLElement;
      expect(root.style.height).toBe('');
      expect(root.style.position).not.toBe('relative');
      expect(root.style.display).toBe('grid');

      const items = Array.from(doc.querySelectorAll('[data-grid-container-item]')) as HTMLElement[];
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        expect(item.style.position).not.toBe('absolute');
        expect(item.style.gridRow).toBe('auto');
        expect(item.style.gridColumn).not.toBe('');
      });
    });

    it('AC14 — Phase 2 items carry a definite two-line gridColumn (N / N+1), never a bare N whose auto end line stretches an absolutely positioned item to the container edge', () => {
      const { container } = render(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
        </GridContainer>
      );

      const items = Array.from(container.querySelectorAll('[data-grid-container-item]')) as HTMLElement[];
      expect(items).toHaveLength(3);
      items.forEach((item) => {
        // jsdom measures synchronously during commit, so the render is already in Phase 2.
        expect(item.style.position).toBe('absolute');
        const col = Number(item.getAttribute('data-grid-container-column-index'));
        expect(item.style.gridColumn).toBe(`${col + 1} / ${col + 2}`);
      });
    });

    it('AC14 — the container height drops the trailing row gap and Phase 2 offsets include the computed row-gap', () => {
      setInnerWidth(500); // below `md`: exactly baseCols (2) columns
      const original = window.getComputedStyle;
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
        const real = original(el, pseudo);
        if ((el as HTMLElement).getAttribute?.('data-grid-container-layout') === 'masonry') {
          return new Proxy(real, { get: (t, k) => (k === 'rowGap' ? '16px' : Reflect.get(t, k)) });
        }
        return real;
      });
      const heights: Record<string, number> = { A: 100, B: 100, C: 40 };
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return heights[this.textContent ?? ''] ?? 0;
      });

      const { container } = render(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          <div>A</div>
          <div>B</div>
          <div>C</div>
        </GridContainer>
      );

      const root = container.querySelector('[data-grid-container-layout="masonry"]') as HTMLElement;
      const items = Array.from(container.querySelectorAll('[data-grid-container-item]')) as HTMLElement[];
      // A -> col0 @0, B -> col1 @0, C -> shortest column (col0, tie -> first) @ 100 + 16.
      expect(items[2].style.transform).toBe('translateY(116px)');
      // tallest column = 100 + 16 + 40 + 16 = 172, minus the trailing gap = 156.
      expect(root.style.height).toBe('156px');
    });

    it('AC4 — index-major Tab/DOM order: items appear in the flat parent in itemIndex order, not grouped by column', () => {
      setInnerWidth(1536); // 2xl breakpoint, baseCols=2/colsStep=1 -> 6 columns
      const { container } = render(
        <GridContainer baseCols={2} colsStep={1} layout="masonry">
          <div key="a">A</div>
          <div key="b">B</div>
          <div key="c">C</div>
          <div key="d">D</div>
        </GridContainer>
      );

      const items = Array.from(container.querySelectorAll('[data-grid-container-item]'));
      const domOrderIndices = items.map((el) => el.getAttribute('data-grid-container-item-index'));
      expect(domOrderIndices).toEqual(['0', '1', '2', '3']);
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

    it('translates the gap prop onto the single flat parent (native CSS Grid gap, AC2) — same mechanism as before, no per-column track to also apply it to', () => {
      const { container } = render(
        <GridContainer layout="masonry" gap="gap-x-2 gap-y-6">
          <div>Item 1</div>
        </GridContainer>
      );
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain('gap-x-2');
      expect(root.className).toContain('gap-y-6');
    });
  });
});
