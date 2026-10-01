/**
 * AD-26 Rule 5, overflow/clipping content-variant catalog: derives a formatting function's
 * content-variant catalog via static analysis of its branches (ts-morph), rather than
 * hand-authored fixtures -- so overflow checks cover variants a prototype never itself
 * depicted (AC9).
 *
 * Enumerates branch *shapes* (each `if`/`else if`/`else`/`case` arm the function can take),
 * labeling each with the source text of its return expression. This does not enumerate
 * arbitrary translated string content -- i18n string-length variance is an accepted gap
 * (AD-26 Rule 5 notes this explicitly).
 */

import { Project, SyntaxKind, type Node } from 'ts-morph';

export interface ContentVariant {
  /** Human-readable label for the branch, derived from its guarding condition (or "default"/
   * "fallback" for an unconditional terminal branch). */
  label: string;
  /** Source text of the branch's return expression, for debugging/reporting. */
  returnExpressionText: string;
  /**
   * Best-effort *displayable* stand-in for the branch's runtime output, for overflow rendering.
   * A branch's return expression usually isn't a bare literal (it mixes call expressions,
   * optional-chaining fallbacks, object shapes) so this is not a guarantee of the exact runtime
   * string -- it's the longest string literal found anywhere in the return expression (the
   * common shape here is `somethingDynamic ?? 'Literal Label'`, so the literal is a real,
   * representative piece of that branch's actual displayed text), or a domain-appropriate
   * placeholder of comparable length when the branch has no string literal at all (e.g. a bare
   * `formatWeekday(...)` call, which renders a long weekday name at runtime).
   */
  sampleText: string;
}

const DEFAULT_SAMPLE_TEXT_FALLBACK = 'Wednesday'; // representative length for a bare-call branch (e.g. a weekday-name formatter)

function extractSampleText(returnExpressionText: string): string {
  const literalMatches = [...returnExpressionText.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? '');
  if (literalMatches.length === 0) {
    return DEFAULT_SAMPLE_TEXT_FALLBACK;
  }
  return literalMatches.reduce((longest, current) => (current.length > longest.length ? current : longest), literalMatches[0]);
}

/**
 * Parses `filePath`'s source text (as a string, so callers can pass either a real file's
 * contents or an in-memory fixture) and enumerates `functionName`'s reachable branches.
 *
 * Supports the two shapes this repo's formatting functions actually use: a chain of
 * `if`/`else if`/`else` guarding `return` statements, and `switch`/`case` blocks. Each
 * branch's terminal `return` contributes one variant.
 */
export function enumerateContentVariants(sourceText: string, functionName: string, fileName = 'source.ts'): ContentVariant[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(fileName, sourceText);

  const fn = sourceFile
    .getFunctions()
    .find((f) => f.getName() === functionName);

  if (!fn) {
    throw new Error(`Function "${functionName}" not found in ${fileName}`);
  }

  const body = fn.getBody();
  if (!body) {
    throw new Error(`Function "${functionName}" has no body`);
  }

  const variants: Array<Omit<ContentVariant, 'sampleText'>> = [];

  /**
   * Story 1.i1n AC6/Task 4: a branch's terminal `return` can itself contain a content-bearing
   * `ConditionalExpression` (a ternary) that the walker above never recurses into on its own --
   * the exact shape `formatShortEventDateTimeParts`'s `dayDiff === 0` branch uses:
   * `return { month: '', day: hasTime ? formatEventTime(...) : (labels?.today ?? 'Today') };`.
   * Without this, `extractSampleText` silently collapses to whichever string literal it happens
   * to find first in the whole return expression's text, losing one real runtime variant.
   *
   * Looks for a `ConditionalExpression` either as the return expression itself, or as the
   * top-level initializer of one of an object-literal return's properties (the shape above) --
   * not an arbitrarily deep search, matching AC6's own "nested in a branch's return expression
   * (an object literal property value)" scope. When found, yields two sub-variants instead of
   * one, `${label} (true)` / `${label} (false)`, each sourced from the ternary's own
   * `whenTrue`/`whenFalse` sub-expression text -- `extractSampleText` is then applied to each
   * sub-expression independently, so e.g. `formatEventTime(...)` (no literal) still falls back to
   * `DEFAULT_SAMPLE_TEXT_FALLBACK` while `(labels?.today ?? 'Today')` still yields `'Today'`.
   */
  function findTopLevelConditional(expr: Node | undefined): Node | undefined {
    if (!expr) return undefined;
    if (expr.isKind(SyntaxKind.ConditionalExpression)) return expr;
    if (expr.isKind(SyntaxKind.ObjectLiteralExpression)) {
      for (const prop of expr.getProperties()) {
        if (prop.isKind(SyntaxKind.PropertyAssignment)) {
          const init = prop.getInitializer();
          if (init && init.isKind(SyntaxKind.ConditionalExpression)) {
            return init;
          }
        }
      }
    }
    return undefined;
  }

  function pushReturnVariant(label: string, returnExpr: Node | undefined): void {
    const conditional = findTopLevelConditional(returnExpr);
    if (conditional && conditional.isKind(SyntaxKind.ConditionalExpression)) {
      variants.push({ label: `${label} (true)`, returnExpressionText: conditional.getWhenTrue().getText() });
      variants.push({ label: `${label} (false)`, returnExpressionText: conditional.getWhenFalse().getText() });
      return;
    }
    variants.push({ label, returnExpressionText: returnExpr?.getText() ?? 'undefined' });
  }

  /**
   * Walks a `then`/`else` arm's statement. Review Follow-up (patch item 4, 2026-09-22): the
   * original version only inspected a `Block` arm for a *direct* `ReturnStatement` among its
   * immediate children, so a nested `if` inside that block (e.g. `formatEventStatus`'s
   * `if (started) { if (endDayDiff > 0) { return happeningNow } return endsToday }`) was never
   * descended into -- the block's own trailing `return` (`endsToday`) shadowed the nested
   * branch entirely, and the nested branch's real content (the `happeningNow`/"Now" case) was
   * never enumerated. This now recurses into every nested `IfStatement` it finds at any depth
   * inside the arm, in addition to still capturing a same-level trailing `return` as its own
   * variant -- both branches of a case like `started` are enumerated, not just one.
   */
  function collectFromStatement(stmt: Node | undefined, label: string): void {
    if (!stmt) return;
    if (stmt.isKind(SyntaxKind.IfStatement)) {
      collectFromIfStatement(stmt, label);
      return;
    }
    if (stmt.isKind(SyntaxKind.ReturnStatement)) {
      pushReturnVariant(label, stmt.getExpression());
      return;
    }
    if (stmt.isKind(SyntaxKind.Block)) {
      let sawBranch = false;
      for (const inner of stmt.getStatements()) {
        if (inner.isKind(SyntaxKind.IfStatement)) {
          collectFromIfStatement(inner, label);
          sawBranch = true;
        } else if (inner.isKind(SyntaxKind.ReturnStatement)) {
          pushReturnVariant(label, inner.getExpression());
          sawBranch = true;
        }
      }
      if (!sawBranch) {
        variants.push({ label, returnExpressionText: '(no direct return -- nested block)' });
      }
      return;
    }
    variants.push({ label, returnExpressionText: '(no direct return -- nested block)' });
  }

  function collectFromIfStatement(ifStmt: Node, labelPrefix = ''): void {
    if (!ifStmt.isKind(SyntaxKind.IfStatement)) return;
    const condition = ifStmt.getExpression().getText();
    const label = labelPrefix ? `${labelPrefix} && ${condition}` : condition;
    collectFromStatement(ifStmt.getThenStatement(), label);

    const elseStmt = ifStmt.getElseStatement();
    if (!elseStmt) return;
    if (elseStmt.isKind(SyntaxKind.IfStatement)) {
      collectFromIfStatement(elseStmt, labelPrefix);
    } else {
      collectFromStatement(elseStmt, labelPrefix ? `${labelPrefix} && else` : 'else');
    }
  }

  const topLevelIfs = body.isKind(SyntaxKind.Block) ? body.getStatements().filter((s) => s.isKind(SyntaxKind.IfStatement)) : [];

  for (const ifStmt of topLevelIfs) {
    collectFromIfStatement(ifStmt);
  }

  // A trailing unconditional return after the if/else-if chain (the common
  // "not started / upcoming" fallback shape) counts as its own variant.
  if (body.isKind(SyntaxKind.Block)) {
    const statements = body.getStatements();
    const last = statements[statements.length - 1];
    if (last && last.isKind(SyntaxKind.ReturnStatement)) {
      pushReturnVariant('fallback', last.getExpression());
    }
  }

  const switchStatements = body.isKind(SyntaxKind.Block)
    ? body.getDescendantsOfKind(SyntaxKind.SwitchStatement)
    : [];
  for (const sw of switchStatements) {
    for (const clause of sw.getClauses()) {
      const isDefault = clause.isKind(SyntaxKind.DefaultClause);
      const label = isDefault ? 'default' : clause.asKindOrThrow(SyntaxKind.CaseClause).getExpression().getText();
      const ret = clause.getStatements().find((s) => s.isKind(SyntaxKind.ReturnStatement));
      if (ret && ret.isKind(SyntaxKind.ReturnStatement)) {
        pushReturnVariant(label, ret.getExpression());
      } else {
        variants.push({ label, returnExpressionText: '(no direct return)' });
      }
    }
  }

  if (variants.length === 0) {
    throw new Error(`No enumerable if/else or switch branches found in "${functionName}"`);
  }

  return variants.map((v) => ({ ...v, sampleText: extractSampleText(v.returnExpressionText) }));
}
