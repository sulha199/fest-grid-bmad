import { ApifyApiError, ApifyClient } from 'apify-client';
import { loadBackendEnv } from '../src/env.js';

const TARGET_URL = 'https://www.instagram.com/pakuwonmall.jogja/';

async function main() {
  const env = loadBackendEnv();

  if (!env.apifyApiToken) {
    console.error('APIFY_API_TOKEN is not set (checked repo-root .env and apps/backend/.env). Aborting.');
    process.exit(1);
  }
  console.log(`Using APIFY_API_TOKEN: ${env.apifyApiToken.slice(0, 6)}... (${env.apifyApiToken.length} chars)`);

  const client = new ApifyClient({ token: env.apifyApiToken });

  const input = {
    directUrls: [TARGET_URL],
    resultsType: 'posts',
    resultsLimit: 3,
  };
  console.log('Calling actor apify/instagram-api-scraper with input:', input);

  try {
    const run = await client.actor('apify/instagram-api-scraper').call(input);

    console.log('--- Run result ---');
    console.log({
      id: run.id,
      actId: run.actId,
      status: run.status,
      statusMessage: (run as any).statusMessage,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      defaultDatasetId: run.defaultDatasetId,
      consoleUrl: `https://console.apify.com/actors/runs/${run.id}`,
    });

    if (!run.defaultDatasetId) {
      console.error('No defaultDatasetId on the run result — nothing to fetch.');
      return;
    }

    const { items, total, count } = await client.dataset(run.defaultDatasetId).listItems({ clean: true, limit: 1000 });
    console.log(`--- Dataset items (count=${count}, total=${total}) ---`);
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
  } catch (err) {
    console.error('--- Apify call failed ---');
    if (err instanceof ApifyApiError) {
      console.error({
        type: err.type,
        statusCode: err.statusCode,
        message: err.message,
        data: err.data,
      });
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main();
