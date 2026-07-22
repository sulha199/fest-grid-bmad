# Edge Case Hunter Prompt

Invoke the `bmad-review-edge-case-hunter` skill on this diff:

```diff
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 0000000..cac8c57
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,42 @@
+# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.
+
+# Dependencies
+node_modules
+.pnp
+.pnp.js
+
+# Local env files
+.env
+.env.local
+.env.development.local
+.env.test.local
+.env.production.local
+
+# Testing
+coverage
+
+# Turbo
+.turbo
+
+# Vercel
+.vercel
+
+# Build Outputs
+.next/
+out/
+build
+dist
+
+
+# Debug
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+
+# Misc
+.DS_Store
+*.pem
+
+.vercel
+.env*.local
+.envrc
diff --git a/.npmrc b/.npmrc
new file mode 100644
index 0000000..e4a192b
--- /dev/null
+++ b/.npmrc
@@ -0,0 +1,2 @@
+confirm-modules-purge=false
+confirmModulesPurge=false
diff --git b/apps/web/next-env.d.ts b/apps/web/next-env.d.ts
new file mode 100644
index 0000000..830fb59
--- /dev/null
+++ b/apps/web/next-env.d.ts
@@ -0,0 +1,6 @@
+/// <reference types="next" />
+/// <reference types="next/image-types/global" />
+/// <reference path="./.next/types/routes.d.ts" />
+
+// NOTE: This file should not be edited
+// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
diff --git "a/apps/web/package.json" "b/apps/web/package.json"
new file mode 100644
index 0000000..f64e62b
--- /dev/null
+++ "b/apps/web/package.json"
@@ -0,0 +1,23 @@
+{
+  "name": "web",
+  "version": "1.0.0",
+  "private": true,
+  "scripts": {
+    "dev": "next dev",
+    "build": "next build",
+    "start": "next start",
+    "lint": "next lint"
+  },
+  "dependencies": {
+    "next": "^15.1.3",
+    "react": "^19.0.0",
+    "react-dom": "^19.0.0",
+    "@festgrid/shared-types": "workspace:*"
+  },
+  "devDependencies": {
+    "@types/node": "^20.14.10",
+    "@types/react": "^19.0.2",
+    "@types/react-dom": "^19.0.2",
+    "typescript": "^6.0.3"
+  }
+}
diff --git a/apps/web/src/app/layout.tsx b/apps/web/src/app/layout.tsx
new file mode 100644
index 0000000..161bec2
--- /dev/null
+++ b/apps/web/src/app/layout.tsx
@@ -0,0 +1,20 @@
+import React from 'react';
+
+export const metadata = {
+  title: 'FestGrid',
+  description: 'AI-Powered Music Festival Grid and Scheduler',
+};
+
+export default function RootLayout({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
+  return (
+    <html lang="en">
+      <body>
+        <main>{children}</main>
+      </body>
+    </html>
+  );
+}
diff --git "a/apps/web/src/app/page.tsx" "b/apps/web/src/app/page.tsx"
new file mode 100644
index 0000000..335b788
--- /dev/null
+++ "b/apps/web/src/app/page.tsx"
@@ -0,0 +1,25 @@
+import React from 'react';
+import type { Event } from '@festgrid/shared-types';
+
+const sampleEvent: Event = {
+  id: '1',
+  eventName: 'Coachella 2026',
+  performers: ['Various Artists'],
+  location: 'Indio, California',
+  date: '2026-04-10',
+};
+
+export default function Home() {
+  return (
+    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
+      <h1>Welcome to FestGrid 🎧</h1>
+      <p>Initializing pnpm monorepo successful!</p>
+      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
+        <h2>Sample Event from @festgrid/shared-types:</h2>
+        <p><strong>Name:</strong> {sampleEvent.eventName}</p>
+        <p><strong>Location:</strong> {sampleEvent.location}</p>
+        <p><strong>Date:</strong> {sampleEvent.date}</p>
+      </div>
+    </div>
+  );
+}
diff --git "a/apps/web/tsconfig.json" "b/apps/web/tsconfig.json"
new file mode 100644
index 0000000..825d679
--- /dev/null
+++ "b/apps/web/tsconfig.json"
@@ -0,0 +1,27 @@
+{
+  "compilerOptions": {
+    "target": "es2022",
+    "lib": ["dom", "dom.iterable", "esnext"],
+    "allowJs": true,
+    "skipLibCheck": true,
+    "strict": true,
+    "noEmit": true,
+    "esModuleInterop": true,
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "resolveJsonModule": true,
+    "isolatedModules": true,
+    "jsx": "preserve",
+    "incremental": true,
+    "plugins": [
+      {
+        "name": "next"
+      }
+    ],
+    "paths": {
+      "@/*": ["./src/*"]
+    }
+  },
+  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
+  "exclude": ["node_modules"]
+}
diff --git a/package.json b/package.json
new file mode 100644
index 0000000..349563f
--- /dev/null
+++ b/package.json
@@ -0,0 +1,16 @@
+{
+  "name": "festgrid",
+  "private": true,
+  "packageManager": "pnpm@11.15.1",
+  "scripts": {
+    "build": "turbo run build",
+    "dev": "turbo run dev",
+    "lint": "turbo run lint"
+  },
+  "devDependencies": {
+    "eslint": "^9.9.0",
+    "turbo": "^2.0.14",
+    "typescript": "^6.0.3",
+    "typescript-eslint": "^8.50.0"
+  }
+}
diff --git a/packages/eslint-config/README.md b/packages/eslint-config/README.md
new file mode 100644
index 0000000..8b42d90
--- /dev/null
+++ b/packages/eslint-config/README.md
@@ -0,0 +1,3 @@
+# `@turbo/eslint-config`
+
+Collection of internal eslint configurations.
diff --git b/packages/eslint-config/base.js b/packages/eslint-config/base.js
new file mode 100644
index 0000000..09d316e
--- /dev/null
+++ b/packages/eslint-config/base.js
@@ -0,0 +1,32 @@
+import js from "@eslint/js";
+import eslintConfigPrettier from "eslint-config-prettier";
+import turboPlugin from "eslint-plugin-turbo";
+import tseslint from "typescript-eslint";
+import onlyWarn from "eslint-plugin-only-warn";
+
+/**
+ * A shared ESLint configuration for the repository.
+ *
+ * @type {import("eslint").Linter.Config[]}
+ * */
+export const config = [
+  js.configs.recommended,
+  eslintConfigPrettier,
+  ...tseslint.configs.recommended,
+  {
+    plugins: {
+      turbo: turboPlugin,
+    },
+    rules: {
+      "turbo/no-undeclared-env-vars": "warn",
+    },
+  },
+  {
+    plugins: {
+      "only-warn": onlyWarn,
+    },
+  },
+];
diff --git b/packages/eslint-config/next.js b/packages/eslint-config/next.js
new file mode 100644
index 0000000..9634e06
--- /dev/null
+++ b/packages/eslint-config/next.js
@@ -0,0 +1,57 @@
+import js from "@eslint/js";
+import eslintConfigPrettier from "eslint-config-prettier";
+import tseslint from "typescript-eslint";
+import pluginReactHooks from "eslint-plugin-react-hooks";
+import pluginReact from "eslint-plugin-react";
+import globals from "globals";
+import pluginNext from "@next/eslint-plugin-next";
+import { config as baseConfig } from "./base.js";
+
+/**
+ * A custom ESLint configuration for libraries that use Next.js.
+ *
+ * @type {import("eslint").Linter.Config[]} */
+export const config = [
+  ...baseConfig,
+  js.configs.recommended,
+  eslintConfigPrettier,
+  ...tseslint.configs.recommended,
+  {
+    ...pluginReact.configs.flat.recommended,
+    languageOptions: {
+      ...pluginReact.configs.flat.recommended.languageOptions,
+      globals: {
+        ...globals.serviceworker,
+      },
+    },
+  },
+  {
+    plugins: {
+      "react-hooks": pluginReactHooks,
+    },
+    settings: { react: { version: "detect" } },
+    rules: {
+      ...pluginReactHooks.configs.recommended.rules,
+      // React scope no longer necessary with new JSX transform.
+      "react/react-in-jsx-scope": "off",
+    },
+  },
+  {
+    plugins: {
+      "@next/next": pluginNext,
+    },
+    rules: {
+      ...pluginNext.configs.recommended.rules,
+      ...pluginNext.configs["core-web-vitals"].rules,
+    },
+  },
+  {
+    languageOptions: {
+      globals: {
+        ...globals.browser,
+        ...globals.node,
+      },
+    },
+  },
+];
diff --git "a/packages/eslint-config/package.json" "b/packages/eslint-config/package.json"
new file mode 100644
index 0000000..98e8495
--- /dev/null
+++ "b/packages/eslint-config/package.json"
@@ -0,0 +1,24 @@
+{
+  "name": "@repo/eslint-config",
+  "version": "0.0.0",
+  "type": "module",
+  "private": true,
+  "exports": {
+    "./base": "./base.js",
+    "./next-js": "./next.js",
+    "./react-internal": "./react-internal.js"
+  },
+  "devDependencies": {
+    "@eslint/js": "^9.39.1",
+    "@next/eslint-plugin-next": "^16.2.0",
+    "eslint": "^9.9.0",
+    "eslint-config-prettier": "^10.1.1",
+    "eslint-plugin-only-warn": "^1.1.0",
+    "eslint-plugin-react": "^7.37.5",
+    "eslint-plugin-react-hooks": "^5.2.0",
+    "eslint-plugin-turbo": "^2.7.1",
+    "globals": "^16.5.0",
+    "typescript": "^6.0.3",
+    "typescript-eslint": "^8.50.0"
+  }
+}
diff --git b/packages/eslint-config/react-internal.js b/packages/eslint-config/react-internal.js
new file mode 100644
index 0000000..daeccba
--- /dev/null
+++ b/packages/eslint-config/react-internal.js
@@ -0,0 +1,39 @@
+import js from "@eslint/js";
+import eslintConfigPrettier from "eslint-config-prettier";
+import tseslint from "typescript-eslint";
+import pluginReactHooks from "eslint-plugin-react-hooks";
+import pluginReact from "eslint-plugin-react";
+import globals from "globals";
+import { config as baseConfig } from "./base.js";
+
+/**
+ * A custom ESLint configuration for libraries that use React.
+ *
+ * @type {import("eslint").Linter.Config[]} */
+export const config = [
+  ...baseConfig,
+  js.configs.recommended,
+  eslintConfigPrettier,
+  ...tseslint.configs.recommended,
+  pluginReact.configs.flat.recommended,
+  {
+    languageOptions: {
+      ...pluginReact.configs.flat.recommended.languageOptions,
+      globals: {
+        ...globals.serviceworker,
+        ...globals.browser,
+      },
+    },
+  },
+  {
+    plugins: {
+      "react-hooks": pluginReactHooks,
+    },
+    settings: { react: { version: "detect" } },
+    rules: {
+      ...pluginReactHooks.configs.recommended.rules,
+      // React scope no longer necessary with new JSX transform.
+      "react/react-in-jsx-scope": "off",
+    },
+  },
+];
diff --git "a/packages/shared-types/package.json" "b/packages/shared-types/package.json"
new file mode 100644
index 0000000..6a1d37c
--- /dev/null
+++ "b/packages/shared-types/package.json"
@@ -0,0 +1,7 @@
+{
+  "name": "@festgrid/shared-types",
+  "version": "1.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "types": "./src/index.ts"
+}
diff --git b/packages/shared-types/src/index.ts b/packages/shared-types/src/index.ts
new file mode 100644
index 0000000..1364b5b
--- /dev/null
+++ b/packages/shared-types/src/index.ts
@@ -0,0 +1,15 @@
+export interface User {
+  id: string;
+  email: string;
+  name?: string;
+}
+
+export interface Event {
+  id: string;
+  eventName: string;
+  performers?: string[];
+  location?: string;
+  types?: string[];
+  categories?: string[];
+  date: string;
+}
diff --git "a/packages/shared-types/tsconfig.json" "b/packages/shared-types/tsconfig.json"
new file mode 100644
index 0000000..712690d
--- /dev/null
+++ "b/packages/shared-types/tsconfig.json"
@@ -0,0 +1,16 @@
+{
+  "compilerOptions": {
+    "target": "es2022",
+    "lib": ["es2022", "dom"],
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "strict": true,
+    "esModuleInterop": true,
+    "skipLibCheck": true,
+    "forceConsistentCasingInFileNames": true,
+    "declaration": true,
+    "rootDir": "./src",
+    "outDir": "./dist"
+  },
+  "include": ["src/**/*"]
+}
diff --git b/packages/typescript-config/base.json b/packages/typescript-config/base.json
new file mode 100644
index 0000000..79fa7a4
--- /dev/null
+++ b/packages/typescript-config/base.json
@@ -0,0 +1,21 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "compilerOptions": {
+    "target": "ES2022",
+    "module": "ESNext",
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+
+    "moduleResolution": "Bundler",
+    "esModuleInterop": true,
+    "isolatedModules": true,
+    "resolveJsonModule": true,
+
+    "strict": true,
+    "forceConsistentCasingInFileNames": true,
+    "skipLibCheck": true,
+
+    "declaration": true,
+    "declarationMap": true,
+    "sourceMap": true
+  }
+}
diff --git b/packages/typescript-config/nextjs.json b/packages/typescript-config/nextjs.json
new file mode 100644
index 0000000..e6defa4
--- /dev/null
+++ b/packages/typescript-config/nextjs.json
@@ -0,0 +1,12 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "extends": "./base.json",
+  "compilerOptions": {
+    "plugins": [{ "name": "next" }],
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
+    "allowJs": true,
+    "jsx": "preserve",
+    "noEmit": true
+  }
+}
diff --git "a/packages/typescript-config/package.json" "b/packages/typescript-config/package.json"
new file mode 100644
index 0000000..27c0e60
--- /dev/null
+++ "b/packages/typescript-config/package.json"
@@ -0,0 +1,9 @@
+{
+  "name": "@repo/typescript-config",
+  "version": "0.0.0",
+  "private": true,
+  "license": "MIT",
+  "publishConfig": {
+    "access": "public"
+  }
+}
diff --git b/packages/typescript-config/react-library.json b/packages/typescript-config/react-library.json
new file mode 100644
index 0000000..c3a1b26
--- /dev/null
+++ b/packages/typescript-config/react-library.json
@@ -0,0 +1,7 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "extends": "./base.json",
+  "compilerOptions": {
+    "jsx": "react-jsx"
+  }
+}
diff --git b/pnpm-workspace.yaml b/pnpm-workspace.yaml
new file mode 100644
index 0000000..d51c59f
--- /dev/null
+++ b/pnpm-workspace.yaml
@@ -0,0 +1,5 @@
+packages:
+  - 'apps/*'
+  - 'packages/*'
+allowBuilds:
+  sharp: true
diff --git b/tsconfig.json b/tsconfig.json
new file mode 100644
index 0000000..5ef67fd
--- /dev/null
+++ b/tsconfig.json
@@ -0,0 +1,3 @@
+{
+  "extends": "./packages/typescript-config/base.json"
+}
diff --git b/turbo.json b/turbo.json
new file mode 100644
index 0000000..84237f6
--- /dev/null
+++ b/turbo.json
@@ -0,0 +1,16 @@
+{
+  "$schema": "https://turbo.build/schema.json",
+  "tasks": {
+    "build": {
+      "dependsOn": ["^build"],
+      "outputs": [".next/**", "dist/**"]
+    },
+    "lint": {
+      "dependsOn": ["^lint"]
+    },
+    "dev": {
+      "cache": false,
+      "persistent": true
+    }
+  }
+}
```
