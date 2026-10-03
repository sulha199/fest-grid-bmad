// One-off local measurement script for Story 0.46 (AC6 / Task 5).
// Synthesizes the stack into a controlled outdir, locates the aiProcessorLambda asset
// directory (the one whose bundled node_modules contains sharp), and prints its path so a
// follow-up step can measure unzipped size (directory walk) and zipped size (archive it).
// NOT part of any Lambda handler or the production deploy path -- a measurement aid only.
import * as cdk from 'aws-cdk-lib';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FestgridBackendStack } from '../lib/festgrid-backend-stack.js';

const outdir = process.argv[2];
if (!outdir) {
  console.error('usage: node measure-ai-processor-asset-size.mjs <outdir>');
  process.exit(1);
}

const app = new cdk.App({ outdir });
new FestgridBackendStack(app, 'SizeCheckStack', { stageName: 'dev' });
app.synth();

const assetEntries = fs.readdirSync(outdir).filter((name) => name.startsWith('asset.'));
const aiProcessorAssetDir = assetEntries
  .map((name) => path.join(outdir, name))
  .find((dir) => fs.existsSync(path.join(dir, 'node_modules', 'sharp')));

if (!aiProcessorAssetDir) {
  console.error('could not find the aiProcessorLambda asset directory');
  process.exit(1);
}

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

const unzippedBytes = dirSizeBytes(aiProcessorAssetDir);
const unzippedMb = unzippedBytes / 1024 / 1024;

console.log(`asset dir: ${aiProcessorAssetDir}`);
console.log(`unzipped size: ${unzippedMb.toFixed(1)} MB (Lambda unzipped limit: 250 MB)`);
console.log(
  unzippedMb > 250
    ? 'EXCEEDS the 250 MB unzipped limit -- a plain zip deployment package is not viable at this size.'
    : 'within the 250 MB unzipped limit.'
);
console.log(
  '\nTo measure the zipped size (what actually uploads), zip this directory with your platform\'s\n' +
    'zip tool, e.g. PowerShell: Compress-Archive -Path "<asset dir>\\*" -DestinationPath out.zip -Force'
);
