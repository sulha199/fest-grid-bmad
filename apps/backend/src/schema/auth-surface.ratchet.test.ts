import test from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { parse, Kind, type FieldDefinitionNode, type TypeNode } from 'graphql';

// AD-7 drift guard: the authorization surface of the GraphQL API.
//
// AD-7 Rule 3 makes `requireAuth` / `requireModerator` (apps/backend/src/lib/auth/context.ts) the single
// way a resolver enforces "caller must be logged in" / "caller must be a moderator". Nothing checked it:
// a new Query or Mutation that forgot the call shipped an open endpoint and no test failed. This is a
// source-scan ratchet, in the style of `events-postid-write-ratchet.test.ts` and
// `no-vendor-call-bypasses-wrapper.ratchet.test.ts`, run on the TypeScript AST of
// `src/schema/resolvers.ts` instead of on regexes so reformatting cannot hide a violation.
//
// What it guarantees, for every root field of the merged schema (the same `.graphql` files `server.ts`
// reads):
//   1. A resolver exists for it, written inline in `resolvers.ts` where this test can see it.
//   2. Unless it is on PUBLIC_ROOT_FIELDS or OPTIONAL_AUTH_ROOT_FIELDS below, the resolver calls
//      `requireAuth`/`requireModerator` on a straight-line statement and before its first `await`, so a
//      mutation cannot write before it knows who is calling. "Straight-line" is checked on the shape of
//      the code, not on every path: the guard must be reached through top-level statements (descending
//      into bare blocks and `try` blocks) with no `if`, loop, `switch`, label, `return` or `throw` ahead
//      of it, so `if (x) return data; requireAuth(c)` fails. A ternary, `&&`/`||`/`??` or callback never
//      counts. A `try` block counts only when its `catch` cannot fall through to the code after it: the
//      catch ends in `throw` or an empty `return` (`return`, `return null`, `return undefined`) and
//      returns no data earlier. `try { requireAuth(c) } catch {}` swallows the failure and is a way to
//      *read* identity, not a guard, and `catch { return await db.select() }` serves the failed caller.
//   3. Both lists stay honest: an entry must name a real field, say why and cite its source, and drops
//      off the moment the resolver stops needing it. They can only shrink or be argued for in review.
//   4. No resolver re-implements the check by reading `context.user` itself (AD-7 Rule 3), apart from
//      the entries in HAND_ROLLED_USER_READS, and no argument or input field lets the client name the
//      acting user (AD-7 Rule 1).
//   5. A field on PUBLIC_ROOT_FIELDS has no session, so nothing reachable from its return type may name a
//      user (`ownerUserId`, `createdByUserId`, ...): a caller who is not signed in must not learn who owns
//      something. `Query.widgetById` returned `ownerUserId` until it moved to `PublicWidget`.
//
// What it does NOT prove: a full control-flow analysis (it reads statement shapes: a guard hidden in a
// helper function it cannot see through, or an exception thrown by a call before the guard, is not
// modelled), or that a resolver authorizes the right *resource* (ownership checks). Those stay with the
// resolvers' own integration tests. A field resolver on an object type (`Event.*`, `Report.*`, ...) is
// outside this scan too. The detector itself is pinned by the "detector" test below.

const backendRoot = process.cwd();
const srcDir = path.resolve(backendRoot, 'src');
const schemaDir = path.resolve(srcDir, 'schema');
const resolversPath = path.join(schemaDir, 'resolvers.ts');
const authModulePath = path.join(srcDir, 'lib/auth/context.ts');

const ROOTS = ['Query', 'Mutation'] as const;
const AUTH_HELPERS = new Set(['requireAuth', 'requireModerator']);

type Exception = { reason: string; source: string };

/**
 * Root fields that deliberately never call `requireAuth`/`requireModerator`: anyone, signed in or not,
 * may call them. Adding one is a product decision, so it needs a reason and a source a reviewer can open.
 */
const PUBLIC_ROOT_FIELDS: Record<string, Exception> = {
  'Query.health': {
    reason: 'Liveness probe. Returns a constant and reads no data.',
    source: 'Story 0.8 (GraphQL server scaffold)',
  },
  'Query.socialMediaAccountProfileByUsername': {
    reason: 'Backs the public, unauthenticated account page.',
    source: 'PRD "Public Account Page"; Architecture Spine AD-35; spec-bug-059-account-url-by-username',
  },
  'Query.voteRegionBreakdown': {
    reason:
      'Aggregate only: voter counts per region, buckets under 5 voters dropped, no user IDs returned (the `count >= 5` floor in the resolver).',
    source:
      'Story 6.1a (account-vote API). No spec states it must be public; allowlisted as observed behaviour. Revisit if the vote list becomes login-only.',
  },
  'Query.widgetById': {
    reason: 'Public embed: the third-party widget page reads the widget configuration without a session.',
    source: 'Story 6.5a AC6 ("public, unauthenticated"); PRD embeddable widget (Section 3)',
  },
  'Query.isOriginAllowedForWidget': {
    reason: 'Public embed: the widget page asks whether the embedding origin is allowed before rendering.',
    source: 'Story 6.6a AC5 ("public, unauthenticated")',
  },
  'Query.relatedEventIds': {
    reason: 'Public event-detail and post-collection pages list the events that share a post.',
    source: 'Stories 3.6u and 3.6x',
  },
  'Query.postByPlatformIdentifiers': {
    reason: 'Public post-collection page resolves a post from its platform identifiers.',
    source: 'Story 3.6x',
  },
  'Query.instagramEmbedBySlug': {
    reason: 'Public event-detail page fetches the Instagram oEmbed for an event slug.',
    source: 'Stories 3.7h and 3.7i',
  },
  'Mutation.reportSystemError': {
    reason: 'Client-side error reporting must work for signed-out visitors and for a failed sign-in.',
    source: 'Story 0.23 ("deliberately never calls requireAuth")',
  },
};

/**
 * Public reads that ask for a session only for part of the request (a personal filter, a moderator-only
 * view), so the guard sits inside a branch by design. Each must still call `requireAuth` or
 * `requireModerator` somewhere; if one ever does so unconditionally it must leave this list.
 */
const OPTIONAL_AUTH_ROOT_FIELDS: Record<string, Exception> = {
  'Query.events': {
    reason:
      'Public discovery list. A session is required only for distance (`withinRadius`) filters and `includeMyArchived`; `includeSoftDeleted` additionally requires a moderator.',
    source: 'AD-1 / AD-2; AD-8 (soft-delete visibility); PRD event discovery',
  },
  'Query.event': {
    reason: 'Public event detail. Only `includeMyArchived` requires a session; moderators additionally see removed events.',
    source: 'AD-8 (soft-delete visibility); Story 3.6u',
  },
  'Query.eventBySlug': {
    reason: 'Public event detail by slug. Only `includeMyArchived` requires a session; moderators additionally see removed events.',
    source: 'AD-16 (event slugs); AD-8',
  },
  'Query.rankedVoteAccounts': {
    reason:
      'Public ranked list. It calls `requireAuth` inside a `try`/`catch` that ignores the failure, only to learn whether a caller is signed in, and never rejects. A non-throwing "who is the caller?" helper in the auth module would replace this pattern.',
    source: 'Story 6.2',
  },
};

/**
 * Resolvers that read `context.user` directly instead of calling the helpers. Both are an
 * "is the caller a moderator?" branch that must not throw for everyone else, which `requireModerator`
 * cannot express. Replacing them with a non-throwing predicate exported by the auth module would remove
 * these entries. Do not add to this list: call `requireAuth`/`requireModerator`.
 */
const HAND_ROLLED_USER_READS: Record<string, Exception> = {
  'src/schema/resolvers.ts#Query.event': {
    reason: 'Optional moderator view: `context.user?.role === "moderator"` widens visibility, never narrows access.',
    source: 'AD-8; Story 3.6u',
  },
  'src/schema/resolvers.ts#Query.eventBySlug': {
    reason: 'Same optional moderator view as Query.event.',
    source: 'AD-8; AD-16',
  },
};

// ---------------------------------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------------------------------

/** The merged schema document, built from the same `.graphql` files `server.ts` reads. */
function readSchemaDocument() {
  const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.graphql'));
  return parse(files.map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n'));
}

function readSchemaRootFields(): Record<(typeof ROOTS)[number], string[]> {
  const fields: Record<string, string[]> = { Query: [], Mutation: [] };
  for (const def of readSchemaDocument().definitions) {
    if (
      (def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION) &&
      (ROOTS as readonly string[]).includes(def.name.value)
    ) {
      for (const field of def.fields ?? []) fields[def.name.value].push(field.name.value);
    }
  }
  return fields as Record<(typeof ROOTS)[number], string[]>;
}

// Names that mean "the user performing this call". The caller's identity comes from the verified
// context (AD-7 Rule 1), never from an argument. `accountId` is a social media account, not a user.
const CLIENT_SUPPLIED_IDENTITY = /^(user|owner|actor|caller|author|moderator|reporter|voter)_?id$/i;

function findClientSuppliedIdentityFields(): string[] {
  const found: string[] = [];
  for (const def of readSchemaDocument().definitions) {
    if (
      (def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION) &&
      (ROOTS as readonly string[]).includes(def.name.value)
    ) {
      for (const field of def.fields ?? []) {
        for (const arg of field.arguments ?? []) {
          if (CLIENT_SUPPLIED_IDENTITY.test(arg.name.value)) found.push(`${def.name.value}.${field.name.value}(${arg.name.value})`);
        }
      }
    }
    if (def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION || def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION) {
      for (const field of def.fields ?? []) {
        if (CLIENT_SUPPLIED_IDENTITY.test(field.name.value)) found.push(`input ${def.name.value}.${field.name.value}`);
      }
    }
  }
  return found.sort();
}

/** A field that identifies a person: `userId`, `ownerUserId`, `createdByUserId`, `voter_id`, ... (any suffix). */
const USER_IDENTIFIER_FIELD = /(user|owner|actor|caller|author|moderator|reporter|voter)_?id$/i;

/**
 * Every field reachable from the return type of each given Query field whose name identifies a user, as
 * "Query.widgetById -> Widget.ownerUserId". Walks object, interface and union types.
 */
function findUserIdentifiersReachableFrom(rootFields: string[], document = readSchemaDocument()): string[] {
  const fieldsByType = new Map<string, readonly FieldDefinitionNode[]>();
  const unionMembers = new Map<string, string[]>();
  for (const def of document.definitions) {
    if (def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION || def.kind === Kind.INTERFACE_TYPE_DEFINITION) {
      fieldsByType.set(def.name.value, [...(fieldsByType.get(def.name.value) ?? []), ...(def.fields ?? [])]);
    }
    if (def.kind === Kind.UNION_TYPE_DEFINITION) unionMembers.set(def.name.value, (def.types ?? []).map((t) => t.name.value));
  }
  const namedType = (t: TypeNode): string => (t.kind === Kind.NAMED_TYPE ? t.name.value : namedType(t.type));

  const found: string[] = [];
  for (const key of rootFields) {
    const [root, name] = key.split('.');
    const field = fieldsByType.get(root)?.find((f) => f.name.value === name);
    if (!field) continue;
    const seen = new Set<string>();
    const walk = (typeName: string) => {
      if (seen.has(typeName)) return;
      seen.add(typeName);
      for (const member of unionMembers.get(typeName) ?? []) walk(member);
      for (const f of fieldsByType.get(typeName) ?? []) {
        if (USER_IDENTIFIER_FIELD.test(f.name.value)) found.push(`${key} -> ${typeName}.${f.name.value}`);
        walk(namedType(f.type));
      }
    };
    walk(namedType(field.type));
  }
  return found.sort();
}

// ---------------------------------------------------------------------------------------------------
// Resolvers (TypeScript AST)
// ---------------------------------------------------------------------------------------------------

function parseSource(file: string): ts.SourceFile {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function propertyName(name: ts.PropertyName): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText();
}

function findResolversObject(sf: ts.SourceFile): ts.ObjectLiteralExpression {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === 'resolvers' && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
        return decl.initializer;
      }
    }
  }
  throw new Error('Expected `export const resolvers = { ... }` in src/schema/resolvers.ts');
}

type RootResolver = {
  key: string; // e.g. "Mutation.castVote"
  fn: ts.FunctionLikeDeclaration | null; // null when the resolver is not an inline function
};

function collectRootResolvers(sf: ts.SourceFile): Map<string, RootResolver> {
  const resolversObject = findResolversObject(sf);
  const map = new Map<string, RootResolver>();
  for (const root of ROOTS) {
    const rootProp = resolversObject.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propertyName(p.name) === root,
    );
    if (!rootProp || !ts.isObjectLiteralExpression(rootProp.initializer)) continue;
    for (const prop of rootProp.initializer.properties) {
      if (!prop.name) continue;
      const key = `${root}.${propertyName(prop.name)}`;
      let fn: ts.FunctionLikeDeclaration | null = null;
      if (ts.isMethodDeclaration(prop)) fn = prop;
      else if (ts.isPropertyAssignment(prop) && (ts.isArrowFunction(prop.initializer) || ts.isFunctionExpression(prop.initializer))) fn = prop.initializer;
      map.set(key, { key, fn });
    }
  }
  return map;
}

const isAuthCall = (n: ts.Node): n is ts.CallExpression =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression) && AUTH_HELPERS.has(n.expression.text);

/** Every `requireAuth`/`requireModerator` call anywhere in the resolver, nested callbacks included. */
function allAuthCalls(fn: ts.FunctionLikeDeclaration): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  const walk = (n: ts.Node) => {
    if (isAuthCall(n)) found.push(n);
    ts.forEachChild(n, walk);
  };
  if (fn.body) walk(fn.body);
  return found;
}

const isShortCircuit = (n: ts.Node): boolean =>
  ts.isBinaryExpression(n) &&
  (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
    n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
    n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken);

/**
 * A statement that decides, before the guard has run, whether the rest of the resolver runs at all:
 * `if (x) return data; requireAuth(context);` hands data to an unauthenticated caller on the `x` path, and
 * a loop or `switch` can exit the same way. Nothing after one of these is on the straight-line path.
 */
const isFlowBarrier = (stmt: ts.Statement): boolean =>
  ts.isIfStatement(stmt) ||
  ts.isForStatement(stmt) ||
  ts.isForInStatement(stmt) ||
  ts.isForOfStatement(stmt) ||
  ts.isWhileStatement(stmt) ||
  ts.isDoStatement(stmt) ||
  ts.isSwitchStatement(stmt) ||
  ts.isLabeledStatement(stmt) ||
  ts.isReturnStatement(stmt) ||
  ts.isThrowStatement(stmt);

/** `return;`, `return null`, `return undefined`, `return void 0`: leaves with no data. */
const isEmptyReturn = (stmt: ts.ReturnStatement): boolean => {
  const e = stmt.expression;
  return (
    e === undefined ||
    e.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(e) && e.text === 'undefined') ||
    ts.isVoidExpression(e)
  );
};

/** Every `return` in a catch block (callbacks excluded) that hands a value back to the caller. */
function returnsAValue(block: ts.Block): boolean {
  let found = false;
  const walk = (n: ts.Node) => {
    if (found || ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n) && !isEmptyReturn(n)) found = true;
    ts.forEachChild(n, walk);
  };
  walk(block);
  return found;
}

/**
 * A catch clause is part of a guard only if the code after the `try` cannot run once `requireAuth`
 * threw: it ends in `throw` or an empty `return`, and no earlier `return` in it carries data
 * (`catch { return await db.select() }` serves the failed caller).
 */
function catchTerminates(clause: ts.CatchClause | undefined): boolean {
  if (!clause) return true; // try/finally: the error propagates
  const last = clause.block.statements[clause.block.statements.length - 1];
  if (last === undefined || returnsAValue(clause.block)) return false;
  return ts.isThrowStatement(last) || ts.isReturnStatement(last);
}

/**
 * The first auth call that runs on the straight-line path: a top-level statement of the function body
 * (descending into `try` blocks and bare blocks), outside any callback, ternary or short-circuit, with no
 * `if`/loop/`switch`/`return`/`throw` ahead of it on the way (`isFlowBarrier`).
 */
function straightLineAuthCall(fn: ts.FunctionLikeDeclaration): ts.CallExpression | null {
  if (!fn.body || !ts.isBlock(fn.body)) return isAuthCall(fn.body ?? fn) ? (fn.body as ts.CallExpression) : null;

  const searchStatement = (stmt: ts.Statement): ts.CallExpression | null => {
    let hit: ts.CallExpression | null = null;
    const walk = (n: ts.Node) => {
      if (hit) return;
      if (ts.isFunctionLike(n) || ts.isConditionalExpression(n) || isShortCircuit(n)) return;
      if (isAuthCall(n)) {
        hit = n;
        return;
      }
      ts.forEachChild(n, walk);
    };
    walk(stmt);
    return hit;
  };

  // `null`: no guard seen yet, keep reading. `'blocked'`: the resolver can leave (or skip ahead) before any
  // guard, so a later call is not on every path and the search ends for the whole function.
  const searchBlock = (statements: readonly ts.Statement[]): ts.CallExpression | 'blocked' | null => {
    for (const stmt of statements) {
      if (ts.isTryStatement(stmt)) {
        const inner = searchBlock(stmt.tryBlock.statements);
        if (inner === 'blocked') return 'blocked';
        if (inner && catchTerminates(stmt.catchClause)) return inner;
        continue;
      }
      if (ts.isBlock(stmt)) {
        const inner = searchBlock(stmt.statements);
        if (inner) return inner;
        continue;
      }
      // `return requireAuth(context)` is a guard that is also the exit; any other barrier is not.
      const found = ts.isVariableStatement(stmt) || ts.isExpressionStatement(stmt) || ts.isReturnStatement(stmt) ? searchStatement(stmt) : null;
      if (found) return found;
      if (isFlowBarrier(stmt)) return 'blocked';
    }
    return null;
  };

  const result = searchBlock(fn.body.statements);
  return result === 'blocked' ? null : result;
}

/** The AD-7 contract for one resolver: a straight-line guard that runs before its first `await`. */
function guardsUpFront(fn: ts.FunctionLikeDeclaration): boolean {
  const guard = straightLineAuthCall(fn);
  return guard !== null && guard.getStart() <= firstAwaitStart(fn);
}

/** Start of the first `await` that runs in the resolver itself (callbacks excluded). */
function firstAwaitStart(fn: ts.FunctionLikeDeclaration): number {
  let first = Number.POSITIVE_INFINITY;
  const walk = (n: ts.Node) => {
    if (ts.isAwaitExpression(n)) first = Math.min(first, n.getStart());
    if (ts.isFunctionLike(n)) return;
    ts.forEachChild(n, walk);
  };
  if (fn.body) ts.forEachChild(fn.body, walk);
  return first;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated' || entry.name === 'node_modules') continue;
      out.push(...listSourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** "Query.event" for a node inside that root resolver, else "" (module level or a helper). */
function enclosingRootField(node: ts.Node): string {
  let member: ts.ObjectLiteralElementLike | null = null;
  for (let cur: ts.Node | undefined = node; cur; cur = cur.parent) {
    if (ts.isObjectLiteralExpression(cur) && cur.parent && ts.isPropertyAssignment(cur.parent)) {
      const root = propertyName(cur.parent.name);
      if ((ROOTS as readonly string[]).includes(root) && member?.name) return `${root}.${propertyName(member.name)}`;
    }
    if (ts.isMethodDeclaration(cur) || ts.isPropertyAssignment(cur)) member = cur;
  }
  return '';
}

/** Reads of the caller's identity that bypass `requireAuth`/`requireModerator`: `context.user`, `{ user }`. */
function findHandRolledUserReads(): string[] {
  const hits = new Set<string>();
  for (const file of listSourceFiles(srcDir)) {
    if (file === authModulePath) continue;
    const rel = path.relative(backendRoot, file).split(path.sep).join('/');
    const sf = parseSource(file);
    const record = (node: ts.Node) => {
      const root = enclosingRootField(node);
      hits.add(root ? `${rel}#${root}` : rel);
    };
    const walk = (n: ts.Node) => {
      if (
        ts.isPropertyAccessExpression(n) &&
        n.name.text === 'user' &&
        ts.isIdentifier(n.expression) &&
        (n.expression.text === 'context' || n.expression.text === 'ctx')
      ) {
        record(n);
      }
      // const { user } = context;  or a destructured resolver parameter  (_, args, { user }) => ...
      if (ts.isObjectBindingPattern(n) && n.elements.some((e) => !e.dotDotDotToken && (e.propertyName ?? e.name).getText() === 'user')) {
        const owner = n.parent;
        const fromContext =
          (ts.isVariableDeclaration(owner) && owner.initializer && ts.isIdentifier(owner.initializer) && ['context', 'ctx'].includes(owner.initializer.text)) ||
          (ts.isParameter(owner) && owner.type !== undefined && /GraphQLContext/.test(owner.type.getText()));
        if (fromContext) record(n);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  return [...hits].sort();
}

// ---------------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------------

const none = (violations: string[], message: string) =>
  assert.strictEqual(violations.length, 0, `${message}\n  - ${violations.join('\n  - ')}`);

/** A resolver-shaped arrow function parsed from `body`, to run the detector on a snippet. */
function resolverFromBody(body: string): ts.FunctionLikeDeclaration {
  const source = `const resolver = async (_: unknown, args: any, context: any) => {\n${body}\n};`;
  const file = ts.createSourceFile('snippet.ts', source, ts.ScriptTarget.Latest, true);
  const decl = (file.statements[0] as ts.VariableStatement).declarationList.declarations[0];
  return decl.initializer as ts.ArrowFunction;
}

test('AD-7 ratchet detector: what counts as an up-front guard', async (t) => {
  // Each snippet is the body of a resolver. A mutation check of the detector is this table: weaken
  // `isFlowBarrier`, `catchTerminates` or the `'blocked'` propagation and a row below goes red.
  const guarded: Record<string, string> = {
    'guard first, then work': `requireAuth(context); return await db.select();`,
    'guard result kept': `const user = requireModerator(context); await db.select(); return user;`,
    'plain statements before the guard': `const limit = args.first ?? 10; const offset = 0; requireAuth(context); return await db.select();`,
    'guard inside a bare block': `{ requireAuth(context); } return await db.select();`,
    'guard returned directly': `return requireAuth(context);`,
    'try with a rethrowing catch': `try { requireModerator(context); } catch (e) { throw e; } return await db.select();`,
    'try with an empty-return catch': `try { requireAuth(context); } catch { return null; } return await db.select();`,
    'try with a bare-return catch': `try { requireAuth(context); } catch { return; } return await db.select();`,
    'try/finally': `try { requireAuth(context); } finally { cleanup(); } return await db.select();`,
  };
  const notGuarded: Record<string, string> = {
    'no guard at all': `return await db.select();`,
    'guard only after an await': `const rows = await db.select(); requireAuth(context); return rows;`,
    'if returns data before the guard': `if (args.id) return data; requireAuth(context); return await db.select();`,
    'if throws before the guard': `if (args.id) { throw new Error('x'); } requireAuth(context);`,
    'for loop before the guard': `for (const a of args.list) { total += a; } requireAuth(context);`,
    'for-of loop before the guard': `for (const a of args.list) { return a; } requireAuth(context);`,
    'while loop before the guard': `while (args.x) { break; } requireAuth(context);`,
    'switch before the guard': `switch (args.kind) { case 'a': return 1; } requireAuth(context);`,
    'labelled block before the guard': `out: { if (args.x) break out; } requireAuth(context);`,
    'return before the guard': `return data; requireAuth(context);`,
    'throw before the guard': `throw new Error('closed'); requireAuth(context);`,
    'if inside the try block before the guard': `try { if (args.x) return data; requireAuth(context); } catch (e) { throw e; } return await db.select();`,
    'if inside the try block, guard repeated after it': `try { if (args.x) return data; requireAuth(context); } catch (e) { throw e; } requireAuth(context);`,
    'guard in a branch only': `if (args.x) { requireAuth(context); } return await db.select();`,
    'guard behind &&': `args.x && requireAuth(context); return await db.select();`,
    'guard in a ternary': `args.x ? requireAuth(context) : null; return await db.select();`,
    'guard in a callback': `[1].forEach(() => requireAuth(context)); return await db.select();`,
    'catch swallows the failure': `try { requireAuth(context); } catch {} return await db.select();`,
    'catch that only logs': `try { requireAuth(context); } catch (e) { console.warn(e); } return await db.select();`,
    'catch serves data': `try { requireAuth(context); } catch { return await db.select(); }`,
    'catch returns a value': `try { requireAuth(context); } catch { return []; }`,
    'catch returns data on one path': `try { requireAuth(context); } catch (e) { if (args.x) return rows; throw e; }`,
    'catch returns data then throws': `try { requireAuth(context); } catch (e) { const f = () => 1; if (f()) { return rows; } throw e; }`,
  };

  for (const [name, body] of Object.entries(guarded)) {
    await t.test(`accepts: ${name}`, () => {
      assert.ok(guardsUpFront(resolverFromBody(body)), `expected a guard up front in:\n${body}`);
    });
  }
  for (const [name, body] of Object.entries(notGuarded)) {
    await t.test(`rejects: ${name}`, () => {
      assert.ok(!guardsUpFront(resolverFromBody(body)), `expected NO guard up front in:\n${body}`);
    });
  }
});

test('AD-7 ratchet detector: user identifiers reachable from a return type', () => {
  const schema = parse(`
    type Owner { id: ID! name: String }
    type Thing { id: ID! ownerUserId: ID! owner: Owner }
    type Safe { id: ID! name: String nested: Inner }
    type Inner { label: String createdByUserId: ID }
    type Clean { id: ID! accountId: ID! }
    union Either = Thing | Clean
    type Query {
      thing: Thing
      safe: Safe
      clean: [Clean!]!
      either: Either
      loop: Loop
    }
    type Loop { self: Loop voterId: ID }
  `);
  const probe = (field: string) => findUserIdentifiersReachableFrom([`Query.${field}`], schema);
  assert.deepStrictEqual(probe('thing'), ['Query.thing -> Thing.ownerUserId']);
  assert.deepStrictEqual(probe('safe'), ['Query.safe -> Inner.createdByUserId'], 'found through a nested object type');
  assert.deepStrictEqual(probe('clean'), [], 'accountId is a social media account, not a person');
  assert.deepStrictEqual(probe('either'), ['Query.either -> Thing.ownerUserId'], 'found through a union member');
  assert.deepStrictEqual(probe('loop'), ['Query.loop -> Loop.voterId'], 'a self-referencing type terminates');
});

test('AD-7 authorization-surface ratchet', async (t) => {
  const schemaFields = readSchemaRootFields();
  const sf = parseSource(resolversPath);
  const resolvers = collectRootResolvers(sf);
  const schemaKeys = ROOTS.flatMap((root) => schemaFields[root].map((name) => `${root}.${name}`));

  await t.test('the scan is not vacuous: it sees the whole schema and both root types', () => {
    assert.ok(schemaFields.Query.length >= 30, `expected 30+ Query fields, found ${schemaFields.Query.length}`);
    assert.ok(schemaFields.Mutation.length >= 40, `expected 40+ Mutation fields, found ${schemaFields.Mutation.length}`);
    assert.ok(resolvers.size >= 80, `expected 80+ root resolvers in resolvers.ts, found ${resolvers.size}`);
  });

  await t.test('every Query/Mutation field has an inline resolver in resolvers.ts, and none is left over', () => {
    const missing = schemaKeys.filter((key) => !resolvers.has(key));
    none(missing, 'Schema root field with no resolver in src/schema/resolvers.ts (the auth scan cannot see it; define it inline there):');

    const orphans = [...resolvers.keys()].filter((key) => !schemaKeys.includes(key));
    none(orphans, 'Resolver for a root field that is not in any .graphql file (dead code, or the schema edit is missing):');

    const opaque = [...resolvers.values()].filter((r) => r.fn === null).map((r) => r.key);
    none(opaque, 'Root resolver that is not an inline function, so its auth cannot be checked. Write it inline, or extend this ratchet:');
  });

  await t.test('every root resolver calls requireAuth/requireModerator up front, unless it is listed as public or optional-auth', () => {
    const violations: string[] = [];
    for (const { key, fn } of resolvers.values()) {
      if (!fn || key in PUBLIC_ROOT_FIELDS || key in OPTIONAL_AUTH_ROOT_FIELDS) continue;
      const guard = straightLineAuthCall(fn);
      if (guardsUpFront(fn)) continue;
      if (!guard) {
        const anywhere = allAuthCalls(fn).length > 0;
        violations.push(
          anywhere
            ? `${key}: calls requireAuth/requireModerator only inside a branch or callback. Call it as a top-level statement, or list it in OPTIONAL_AUTH_ROOT_FIELDS with a reason.`
            : `${key}: never calls requireAuth/requireModerator. Add \`requireAuth(context)\` as its first statement, or, if it is meant to be public, list it in PUBLIC_ROOT_FIELDS with a reason and source.`,
        );
      } else if (guard.getStart() > firstAwaitStart(fn)) {
        violations.push(`${key}: awaits something before calling ${guard.expression.getText()}. Authorize first, then touch the database.`);
      }
    }
    none(violations, 'AD-7 Rule 3 violations:');
  });

  await t.test('PUBLIC_ROOT_FIELDS is exact: real fields, never guarded, each with a reason and a source', () => {
    const problems: string[] = [];
    for (const [key, exception] of Object.entries(PUBLIC_ROOT_FIELDS)) {
      const resolver = resolvers.get(key);
      if (!resolver) problems.push(`${key}: no such root resolver (remove the stale entry)`);
      else if (resolver.fn && allAuthCalls(resolver.fn).length > 0) problems.push(`${key}: now calls requireAuth/requireModerator, so it is not public (remove the entry or move it to OPTIONAL_AUTH_ROOT_FIELDS)`);
      if (!exception.reason.trim() || !exception.source.trim()) problems.push(`${key}: reason and source are both required`);
      if (key in OPTIONAL_AUTH_ROOT_FIELDS) problems.push(`${key}: listed as both public and optional-auth`);
    }
    none(problems, 'PUBLIC_ROOT_FIELDS is out of date:');
  });

  await t.test('OPTIONAL_AUTH_ROOT_FIELDS is exact: still guarded, but only inside a branch', () => {
    const problems: string[] = [];
    for (const [key, exception] of Object.entries(OPTIONAL_AUTH_ROOT_FIELDS)) {
      const resolver = resolvers.get(key);
      if (!resolver || !resolver.fn) {
        problems.push(`${key}: no such inline root resolver (remove the stale entry)`);
        continue;
      }
      if (allAuthCalls(resolver.fn).length === 0) problems.push(`${key}: never calls requireAuth/requireModerator, so it is public (move it to PUBLIC_ROOT_FIELDS)`);
      else if (straightLineAuthCall(resolver.fn)) problems.push(`${key}: now authorizes up front, so it no longer needs this exception (remove the entry)`);
      if (!exception.reason.trim() || !exception.source.trim()) problems.push(`${key}: reason and source are both required`);
    }
    none(problems, 'OPTIONAL_AUTH_ROOT_FIELDS is out of date:');
  });

  await t.test('requireAuth and requireModerator are declared once, in lib/auth/context.ts, and resolvers.ts imports them from there', () => {
    const declared: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      if (file === authModulePath) continue;
      if (/\b(function|const|let|var)\s+(requireAuth|requireModerator)\b/.test(fs.readFileSync(file, 'utf8'))) {
        declared.push(path.relative(backendRoot, file));
      }
    }
    none(declared, 'A second declaration of requireAuth/requireModerator shadows the sanctioned one (AD-7 Rule 3):');

    const imported = new Set<string>();
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier) && stmt.moduleSpecifier.text === '../lib/auth/context.js') {
        const bindings = stmt.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((e) => imported.add(e.name.text));
      }
    }
    for (const helper of AUTH_HELPERS) assert.ok(imported.has(helper), `resolvers.ts must import ${helper} from '../lib/auth/context.js'`);
  });

  await t.test('no resolver reads context.user itself, except the listed optional-moderator views (AD-7 Rule 3)', () => {
    const actual = findHandRolledUserReads();
    const unlisted = actual.filter((hit) => !(hit in HAND_ROLLED_USER_READS));
    none(unlisted, 'Hand-rolled identity check. Call requireAuth(context) or requireModerator(context) instead:');

    const stale = Object.keys(HAND_ROLLED_USER_READS).filter((hit) => !actual.includes(hit));
    none(stale, 'HAND_ROLLED_USER_READS lists a read that no longer exists (remove the entry):');
  });

  await t.test('nothing reachable from a public field names a user (a caller with no session must not learn who owns what)', () => {
    none(
      findUserIdentifiersReachableFrom(Object.keys(PUBLIC_ROOT_FIELDS).filter((key) => key.startsWith('Query.'))),
      'Public root field returns a type that carries a user identifier. Return a public type without it (see PublicWidget), or argue the exception in review:',
    );
  });

  await t.test('no root argument or input field lets the client name the acting user (AD-7 Rule 1)', () => {
    none(
      findClientSuppliedIdentityFields(),
      'The caller comes from the verified context, never from an argument. Remove the field, or argue the exception in review and allowlist it here:',
    );
  });
});
