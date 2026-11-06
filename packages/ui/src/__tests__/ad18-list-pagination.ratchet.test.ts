/**
 * Architecture Spine AD-18 Rule 4 (Story 0.i5z) — the ratchet: no list surface keeps its own
 * pagination cursor.
 *
 * AD-18 Rule 4 says a list that pages through a filtered result must own its cursor through
 * `useListPaginationController`, not through a hand-rolled `useState` cursor that someone has to
 * remember to reset when a filter changes. Forgetting that reset is BUG-019 (a filter change
 * appended to, or stayed on, a later page). Stories 0.i5b-0.i5e moved every list onto the
 * controller; this is the repo-wide sweep that stops the next list from going back.
 *
 * Same genre as `ad33-z-index-layering.ratchet.test.ts`: a static scan, not a per-component
 * test, located under `__tests__/` for that reason. It walks `packages/ui/src` and
 * `apps/web/src` and parses each file with the TypeScript compiler API, so a multi-line
 * `useState<...>(...)` cannot slip past the way it could past a regex.
 *
 * What it flags: `const [cursor, setCursor] = useState(...)` and its siblings, i.e. a
 * `useState`/`useReducer` pair whose state or setter is named like pagination state (cursor,
 * endCursor, hasNextPage, pageIndex, ...). It does NOT try to ban *filter* state: a list's
 * filters are legitimately local (they are the controller's `filterKey`), and "is this state a
 * filter?" has no reliable static test. Filter-change-resets-to-page-1 is instead proved
 * behaviourally: by `useListPaginationController.test.ts` for the contract, and by the
 * `pagination` suites of the adopting pages (BUG-019's exact case, one per moderator page).
 * The on-change-versus-Apply timing rule (AD-18 Rules 1-3) is likewise verified there and in
 * the filter controls' own tests, not by per-surface convention.
 *
 * If a list genuinely cannot use the controller, do not add a bypass here: raise it in review,
 * because the controller is the thing to extend.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const EXCLUDED_SEGMENTS = ['__tests__', 'node_modules', 'generated'];
const EXCLUDED_FILENAME_MARKERS = ['.test.', '.spec.', '.stories.'];
const INCLUDED_EXTENSIONS = ['.ts', '.tsx'];

const UI_SRC_ROOT = path.resolve(__dirname, '..');
const WEB_SRC_ROOT = path.resolve(__dirname, '../../../../apps/web/src');

if (!fs.existsSync(WEB_SRC_ROOT)) {
  throw new Error(
    `AD-18 ratchet: resolved apps/web/src root does not exist: ${WEB_SRC_ROOT}. ` +
      'The relative path climb from packages/ui/src/__tests__ needs to be re-verified.'
  );
}

/** State that holds where a list is, or whether it has more: the controller's job. */
const PAGINATION_STATE_NAME =
  /^(cursor|endCursor|afterCursor|nextCursor|pageCursor|currentCursor|cursorHistory|hasNextPage|hasMore|pageIndex|pageNumber|currentPage)$/;
const PAGINATION_SETTER_NAME =
  /^set(Cursor|EndCursor|AfterCursor|NextCursor|PageCursor|CurrentCursor|CursorHistory|HasNextPage|HasMore|PageIndex|PageNumber|CurrentPage)$/;

const STATE_HOOKS = new Set(['useState', 'useReducer']);

type Hit = { name: string; line: number };

/** Every locally declared pagination state pair in `sourceText`. Exported shape is test-only. */
function findLocalPaginationState(sourceText: string, fileName = 'file.tsx'): Hit[] {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];

  const calleeName = (call: ts.CallExpression): string | undefined => {
    const expr = call.expression;
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text; // React.useState
    return undefined;
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      STATE_HOOKS.has(calleeName(node.initializer) ?? '')
    ) {
      const [valueEl, setterEl] = node.name.elements;
      const identifierOf = (el: ts.ArrayBindingElement | undefined) =>
        el && ts.isBindingElement(el) && ts.isIdentifier(el.name) ? el.name.text : undefined;
      const value = identifierOf(valueEl);
      const setter = identifierOf(setterEl);
      const flagged = (value && PAGINATION_STATE_NAME.test(value) ? value : undefined) ?? (setter && PAGINATION_SETTER_NAME.test(setter) ? setter : undefined);
      if (flagged) {
        hits.push({ name: flagged, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function walk(root: string): string[] {
  const results: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_SEGMENTS.includes(entry.name)) visit(full);
      } else if (
        INCLUDED_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) &&
        !EXCLUDED_FILENAME_MARKERS.some((marker) => entry.name.includes(marker))
      ) {
        results.push(full);
      }
    }
  };
  visit(root);
  return results;
}

const repoRoot = path.resolve(__dirname, '../../../..');
const relative = (file: string) => path.relative(repoRoot, file).split(path.sep).join('/');

describe('AD-18 list-pagination ratchet', () => {
  const files = [...walk(UI_SRC_ROOT), ...walk(WEB_SRC_ROOT)];

  it('scans both source roots (the sweep is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(200);
    expect(files.some((f) => f.startsWith(UI_SRC_ROOT))).toBe(true);
    expect(files.some((f) => f.startsWith(WEB_SRC_ROOT))).toBe(true);
  });

  it('every list that pages through a cursor still uses useListPaginationController', () => {
    // A positive control. If an adopter quietly swapped the controller for something the detector
    // cannot see, "no local cursor state" would pass for the wrong reason.
    const adopters = [
      'apps/web/src/app/[locale]/home-content.tsx',
      'apps/web/src/app/[locale]/feed/feed-content.tsx',
      'apps/web/src/app/[locale]/favorites/favorites-content.tsx',
      'apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/post-events-content.tsx',
      'apps/web/src/app/[locale]/moderator/tools/actor-runs-content.tsx',
      'apps/web/src/app/[locale]/moderator/tools/duplicate-events-content.tsx',
      'apps/web/src/app/[locale]/moderator/tools/moderator-accounts-content.tsx',
      'apps/web/src/app/[locale]/moderator/tools/unprocessed-payloads-content.tsx',
    ];
    const notAdopting = adopters.filter((rel) => {
      const full = path.join(repoRoot, rel);
      return !fs.existsSync(full) || !/\buseListPaginationController\s*[<(]/.test(fs.readFileSync(full, 'utf8'));
    });
    expect(notAdopting, `These lists no longer use useListPaginationController:\n  - ${notAdopting.join('\n  - ')}`).toEqual([]);
  });

  it('no file keeps its own cursor, hasNextPage or page-number state', () => {
    const offenders = files.flatMap((file) =>
      findLocalPaginationState(fs.readFileSync(file, 'utf8'), file).map((hit) => `${relative(file)}:${hit.line} (${hit.name})`)
    );
    expect(
      offenders,
      'A list must page through useListPaginationController (AD-18 Rule 4), which resets to page 1 when a filter changes. ' +
        'Local pagination state is how BUG-019 happened. Offenders:\n  - ' +
        offenders.join('\n  - ')
    ).toEqual([]);
  });
});

// The detector is the whole ratchet, so it gets its own controls.
describe('AD-18 ratchet detector', () => {
  it('flags the shapes the moderator pages used to have', () => {
    expect(findLocalPaginationState(`const [cursor, setCursor] = useState<string | undefined>(undefined);`)).toEqual([{ name: 'cursor', line: 1 }]);
    expect(findLocalPaginationState(`const [hasNextPage, setHasNextPage] = useState(false);`)).toEqual([{ name: 'hasNextPage', line: 1 }]);
    expect(findLocalPaginationState(`const [pageIndex, setPageIndex] = React.useState(1);`)).toEqual([{ name: 'pageIndex', line: 1 }]);
  });

  it('flags a multi-line declaration and reports the line it starts on', () => {
    const source = `function A() {\n  const [\n    endCursor,\n    setEndCursor,\n  ] = useState<\n    string | null\n  >(null);\n}`;
    expect(findLocalPaginationState(source)).toEqual([{ name: 'endCursor', line: 2 }]);
  });

  it('flags a pair that discards the value but keeps the setter, and a reducer', () => {
    expect(findLocalPaginationState(`const [, setCursor] = useState(undefined);`)).toEqual([{ name: 'setCursor', line: 1 }]);
    expect(findLocalPaginationState(`const [currentPage, dispatch] = useReducer(reducer, 1);`)).toEqual([{ name: 'currentPage', line: 1 }]);
  });

  it('leaves ordinary state, derived values, and mentions in text alone', () => {
    const source = [
      `const [isOpen, setIsOpen] = useState(false);`,
      `const [filters, setFilters] = useState({});`,
      `const [selectedIndex, setSelectedIndex] = useState(0);`,
      `const cursor = pagination.cursor;`,
      `const { cursor: c, hasNextPage } = pagination;`,
      `// const [cursor, setCursor] = useState(undefined);`,
      `const doc = "const [cursor, setCursor] = useState()";`,
    ].join('\n');
    expect(findLocalPaginationState(source)).toEqual([]);
  });
});
