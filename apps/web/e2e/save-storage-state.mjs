import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const storageStatePath = resolve(process.argv[2] ?? 'e2e/.auth/moderator.json');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];

if (!context) {
  throw new Error('No Chrome browser context is available at http://127.0.0.1:9222.');
}

const appPage = context.pages().find((page) => /^http:\/\/(?:127\.0\.0\.1|localhost):3000\//.test(page.url()));
if (!appPage) {
  throw new Error('Open http://localhost:3000 or http://127.0.0.1:3000 and complete login in the remote-debugged Chrome window before saving state.');
}

await mkdir(dirname(storageStatePath), { recursive: true });
await context.storageState({ path: storageStatePath });

console.log(`Saved authenticated browser state to ${storageStatePath}.`);