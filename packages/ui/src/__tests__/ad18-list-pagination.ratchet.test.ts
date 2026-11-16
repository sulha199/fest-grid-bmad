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
 * What it flags (by name, so this is a tripwire for the shapes people actually write, not a proof):
 *   - `const [cursor, setCursor] = useState(...)` and its siblings: a `useState`/`useReducer` pair
 *     whose state or setter is named like pagination state (cursor, endCursor, hasNextPage,
 *     pageIndex, page, after, ...);
 *   - the same state kept inside an object, `useState({ cursor, hasNextPage })`, or a reducer's
 *     initial state;
 *   - a ref named like it, `const cursorRef = useRef(...)`;
 *   - paging kept in the URL by hand, `useQueryState('page' | 'cursor' | 'after' | 'offset' | ...)`.
 * What it does NOT see, so review must: pagination state wrapped in a custom hook or a store, a
 * name outside the lists below, and `offset` as component state (`swipe-to-reveal.tsx` keeps a
 * gesture offset in `useState`, so `offset` is only flagged as a URL key). It does NOT try to ban *filter* state: a list's
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

/**
 * State that holds where a list is, or whether it has more: the controller's job. One list feeds the
 * state, setter and ref patterns, so they cannot drift. `offset` is deliberately absent: a gesture or
 * scroll offset is ordinary component state (see the header); it is only a pagination name as a URL key.
 */
const PAGINATION_NAMES = [
  'cursor', 'endCursor', 'afterCursor', 'nextCursor', 'pageCursor', 'currentCursor', 'cursorHistory',
  'hasNextPage', 'hasPrevPage', 'hasPreviousPage', 'hasMore', 'hasMorePages', 'isLastPage',
  'pageIndex', 'pageNumber', 'pageNo', 'pageNum', 'currentPage', 'page', 'after', 'skip',
];
const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
const PAGINATION_STATE_NAME = new RegExp(`^(${PAGINATION_NAMES.join('|')})$`);
const PAGINATION_SETTER_NAME = new RegExp(`^set(${PAGINATION_NAMES.map(capitalise).join('|')})$`);
const PAGINATION_REF_NAME = new RegExp(`^(${PAGINATION_NAMES.join('|')})Ref$`);
/** Query-string keys a list must not manage by hand; unlike a state name, `offset` is unambiguous here. */
const PAGINATION_URL_KEYS = new Set([...PAGINATION_NAMES, 'offset']);

const STATE_HOOKS = new Set(['useState', 'useReducer']);

type Hit = { name: string; line: number };

const calleeName = (call: ts.CallExpression): string | undefined => {
  const expr = call.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text; // React.useState
  return undefined;
};

/** The property names of an object literal (`{ cursor, hasNextPage: false }`), shorthand included. */
const objectLiteralKeys = (node: ts.Expression | undefined): string[] => {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  return node.properties.flatMap((prop) => {
    if (!prop.name) return [];
    return ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? [prop.name.text] : [];
  });
};

/** Every locally declared pagination state in `sourceText`. Exported shape is test-only. */
function findLocalPaginationState(sourceText: string, fileName = 'file.tsx'): Hit[] {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];
  const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const call = node.initializer;
      const hook = calleeName(call) ?? '';

      // const [cursor, setCursor] = useState(...) / useReducer(...)
      if (STATE_HOOKS.has(hook) && ts.isArrayBindingPattern(node.name)) {
        const [valueEl, setterEl] = node.name.elements;
        const identifierOf = (el: ts.ArrayBindingElement | undefined) =>
          el && ts.isBindingElement(el) && ts.isIdentifier(el.name) ? el.name.text : undefined;
        const value = identifierOf(valueEl);
        const setter = identifierOf(setterEl);
        const flagged =
          (value && PAGINATION_STATE_NAME.test(value) ? value : undefined) ??
          (setter && PAGINATION_SETTER_NAME.test(setter) ? setter : undefined);
        if (flagged) hits.push({ name: flagged, line: lineOf(node) });

        // ...or the same state kept inside an object: useState({ cursor }), useReducer(reducer, { hasNextPage }).
        // useState takes its initial state first, useReducer second.
        const initialState = hook === 'useReducer' ? call.arguments[1] : call.arguments[0];
        for (const key of objectLiteralKeys(initialState)) {
          if (PAGINATION_STATE_NAME.test(key)) hits.push({ name: `{ ${key} }`, line: lineOf(node) });
        }
      }

      // const cursorRef = useRef(...)
      if (hook === 'useRef' && ts.isIdentifier(node.name) && PAGINATION_REF_NAME.test(node.name.text)) {
        hits.push({ name: node.name.text, line: lineOf(node) });
      }
    }

    // Paging kept in the URL by hand: useQueryState('page', ...). A list's other URL keys are filters.
    if (ts.isCallExpression(node) && calleeName(node) === 'useQueryState') {
      const key = node.arguments[0];
      if (key && ts.isStringLiteralLike(key) && PAGINATION_URL_KEYS.has(key.text)) {
        hits.push({ name: `useQueryState('${key.text}')`, line: lineOf(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/**
 * Whether `sourceText` actually CALLS useListPaginationController (type arguments allowed). Read from the syntax
 * tree, not a text search, so a call that is commented out, quoted in a string or only imported does not count.
 */
function callsPaginationController(sourceText: string, fileName = 'file.tsx'): boolean {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useListPaginationController') {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
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
    // cannot see, "no local cursor state" would pass for the wrong reason. It reads the syntax tree, so
    // commented-out or quoted code does not satisfy it.
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
      return !fs.existsSync(full) || !callsPaginationController(fs.readFileSync(full, 'utf8'), full);
    });
    expect(notAdopting, `These lists no longer use useListPaginationController:\n  - ${notAdopting.join('\n  - ')}`).toEqual([]);
  });

  it('no file keeps its own cursor, hasNextPage or page-number state (by the names and shapes listed in the header)', () => {
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

  it('flags the wider names: page, page number variants, after, skip, and the has-previous/last-page flags', () => {
    for (const name of ['page', 'pageNo', 'pageNum', 'after', 'skip', 'hasPrevPage', 'hasPreviousPage', 'hasMorePages', 'isLastPage']) {
      const setter = 'set' + name.charAt(0).toUpperCase() + name.slice(1);
      expect(findLocalPaginationState(`const [${name}, ${setter}] = useState(0);`), name).toEqual([{ name, line: 1 }]);
      expect(findLocalPaginationState(`const [, ${setter}] = useState(0);`), setter).toEqual([{ name: setter, line: 1 }]);
    }
  });

  it('flags pagination state kept inside an object, in useState and in a reducer\'s initial state', () => {
    expect(findLocalPaginationState(`const [paging, setPaging] = useState({ cursor: undefined, hasNextPage: false });`)).toEqual([
      { name: '{ cursor }', line: 1 },
      { name: '{ hasNextPage }', line: 1 },
    ]);
    expect(findLocalPaginationState(`const [paging, setPaging] = useState<Paging>({ endCursor });`)).toEqual([{ name: '{ endCursor }', line: 1 }]);
    expect(findLocalPaginationState(`const [state, dispatch] = useReducer(reducer, { pageIndex: 1, filters: {} });`)).toEqual([{ name: '{ pageIndex }', line: 1 }]);
    // A reducer's FIRST argument is the function, never its state.
    expect(findLocalPaginationState(`const [state, dispatch] = useReducer({ cursor: 1 } as never, {});`)).toEqual([]);
  });

  it('flags a ref named like pagination state', () => {
    expect(findLocalPaginationState(`const cursorRef = useRef<string>();`)).toEqual([{ name: 'cursorRef', line: 1 }]);
    expect(findLocalPaginationState(`const pageIndexRef = React.useRef(1);`)).toEqual([{ name: 'pageIndexRef', line: 1 }]);
    expect(findLocalPaginationState(`const listRef = useRef(null);`)).toEqual([]);
  });

  it('flags paging kept in the URL by hand, but not a list\'s filter keys', () => {
    for (const key of ['page', 'cursor', 'after', 'offset', 'pageIndex']) {
      expect(findLocalPaginationState(`const [v, setV] = useQueryState('${key}', parseAsInteger);`), key).toEqual([{ name: `useQueryState('${key}')`, line: 1 }]);
    }
    expect(findLocalPaginationState(`const [q, setQ] = useQueryState("q", parseAsString);\nconst [types] = useQueryState('types');\nconst [tab, setTab] = useQueryState("tab", tabEnum);`)).toEqual([]);
  });

  it('does not flag a gesture or scroll offset kept as component state (swipe-to-reveal.tsx)', () => {
    expect(findLocalPaginationState(`const [offset, setOffset] = useState(0);`)).toEqual([]);
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

describe('AD-18 positive control: callsPaginationController', () => {
  it('sees a real call, with or without type arguments, and through an alias-free import', () => {
    expect(callsPaginationController(`const p = useListPaginationController({ filterKey, initialCursor: undefined });`)).toBe(true);
    expect(callsPaginationController(`const p = useListPaginationController<Filters, string | undefined>({ filterKey, initialCursor: undefined });`)).toBe(true);
  });

  it('does not count code that is commented out, quoted, or only imported', () => {
    expect(callsPaginationController(`// const p = useListPaginationController({ filterKey });`)).toBe(false);
    expect(callsPaginationController(`/* const p = useListPaginationController<A, B>({ filterKey }); */`)).toBe(false);
    expect(callsPaginationController(`const doc = "useListPaginationController({ filterKey })";`)).toBe(false);
    expect(callsPaginationController(`const doc = \`useListPaginationController<A>(x)\`;`)).toBe(false);
    expect(callsPaginationController(`import { useListPaginationController } from '@festgrid/ui';`)).toBe(false);
  });
});
