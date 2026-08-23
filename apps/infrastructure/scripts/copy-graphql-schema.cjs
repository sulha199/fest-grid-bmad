// Copies apps/backend/src/schema/*.graphql into a NodejsFunction's bundled
// output. esbuild only bundles .ts/.js, so the .graphql files server.ts reads
// via readdirSync at runtime (see apps/backend/src/server.ts) are otherwise
// missing from the deployed Lambda package.
const fs = require('fs');
const path = require('path');

const [, , inputDir, outputDir] = process.argv;
const srcDir = path.join(inputDir, 'apps', 'backend', 'src', 'schema');
const destDir = path.join(outputDir, 'src', 'schema');

fs.mkdirSync(destDir, { recursive: true });
for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.graphql')) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}
