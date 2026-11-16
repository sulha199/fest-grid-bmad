// One-off, local only (never committed): replays one post image through the REAL extraction request builder and Gemini and
// prints the location fields, to check the location-keywords prompt. No database writes. Usage:
//   npx tsx scripts/replay-keywords-oneoff.ts <imageUrlFile> <runs>
import * as fs from 'fs';
import { buildGeminiExtractionRequest } from '../src/lib/ai-processor/build-gemini-request.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';
import { normalizeLocationKeywords, stripMalformedLocationKeywords } from '@festgrid/domain/events';

async function main() {
  const [urlFile, runsArg] = process.argv.slice(2);
  const imageUrl = fs.readFileSync(urlFile, 'utf8').trim();
  const runs = Number(runsArg ?? '3');
  const apiKey = process.env.SYSTEM_GEMINI_API_KEY;
  if (!apiKey) throw new Error('SYSTEM_GEMINI_API_KEY is not set');

  for (let run = 1; run <= runs; run++) {
    const built = await buildGeminiExtractionRequest({
      postId: 'replay-' + run,
      accountId: 'replay-account',
      content: '',
      imageUrl,
      postUrl: 'https://www.instagram.com/p/DfWWCCIzNw1/',
      publishedAt: '2026-10-30T00:00:00.000Z',
      ownerDisplayName: 'Samsat Sleman',
    });
    let result: Awaited<ReturnType<typeof callGeminiGenerateContent>> | undefined;
    for (let attempt = 1; attempt <= 6 && !result; attempt++) {
      try {
        result = await callGeminiGenerateContent(apiKey, built.request);
      } catch (error) {
        console.error(`attempt ${attempt} failed: ${String(error).slice(0, 120)}`);
        await new Promise((r) => setTimeout(r, 15000 * attempt));
      }
    }
    if (!result) throw new Error('Gemini kept failing');
    const parsed = JSON.parse(result.text as string);
    stripMalformedLocationKeywords(parsed);
    console.log(`\n=== run ${run}: finishReason=${result.finishReason} outputTokens=${result.usage?.outputTokens} events=${parsed.events?.length} grouping=${parsed.groupingReason} kwEvents=${(parsed.events ?? []).filter((e: any) => normalizeLocationKeywords(e.locationKeywords)).length} kwSchedules=${(parsed.events ?? []).flatMap((e: any) => e.schedules ?? []).filter((x: any) => normalizeLocationKeywords(x.locationKeywords)).length}/${(parsed.events ?? []).flatMap((e: any) => e.schedules ?? []).length}`);
    for (const event of parsed.events ?? []) {
      console.log(`event "${event.eventName}" location=${JSON.stringify(event.location)} keywords=${JSON.stringify(normalizeLocationKeywords(event.locationKeywords))} schedules=${event.schedules?.length}`);
      for (const schedule of event.schedules ?? []) {
        console.log(
          `  ${schedule.eventStartDate} title=${JSON.stringify(schedule.title)} location=${JSON.stringify(schedule.location)} keywords=${JSON.stringify(normalizeLocationKeywords(schedule.locationKeywords))}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
