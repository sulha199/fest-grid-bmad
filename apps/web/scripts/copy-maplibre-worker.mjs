// maplibre-gl resolves its worker script via import.meta.url, which webpack's
// client bundle doesn't preserve — it falls back to the page URL at runtime.
// Serving the worker as a static asset and pointing setWorkerUrl() at it
// (see map.tsx) sidesteps that broken resolution.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });

// maplibre-gl-worker.mjs imports maplibre-gl-shared.mjs via a relative
// specifier, so both chunks must be vendored together.
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  const src = require.resolve(`maplibre-gl/dist/${file}`);
  copyFileSync(src, path.join(publicDir, file));
}

console.log('Copied maplibre-gl worker chunks to public/');
