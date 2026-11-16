import test from 'node:test';
import assert from 'node:assert';
import {
  logExtractionScheduleCounts,
  logEnqueueScheduleCounts,
  logEnqueueTotals,
  logIngestScheduleCounts,
} from './schedule-count-log.js';

test('schedule-count-log', async (t) => {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  let infos: string[] = [];
  let warns: string[] = [];
  t.beforeEach(() => {
    infos = [];
    warns = [];
    console.info = (...args: unknown[]) => {
      infos.push(args.map(String).join(' '));
    };
    console.warn = (...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    };
  });
  t.afterEach(() => {
    console.info = originalInfo;
    console.warn = originalWarn;
  });

  await t.test('extraction line carries the model count and the built-message count', () => {
    logExtractionScheduleCounts({ postId: 'p1', eventIndex: 5, eventName: 'Bus Samsat Keliling', modelSchedules: 10, messageSchedules: 10 });
    assert.deepStrictEqual(infos, [
      '[processAiJob] extraction-schedules post=p1 eventIndex=5 name="Bus Samsat Keliling" modelSchedules=10 messageSchedules=10',
    ]);
    assert.deepStrictEqual(warns, []);
  });

  await t.test('a count that differs before the queue is visible in the numbers, with no warning', () => {
    logExtractionScheduleCounts({ postId: 'p1', eventIndex: 0, eventName: 'X', modelSchedules: 10, messageSchedules: 2 });
    assert.match(infos[0], /modelSchedules=10 messageSchedules=2/);
    assert.deepStrictEqual(warns, []);
  });

  await t.test('names are collapsed, clipped to 60 characters and stripped of double quotes', () => {
    logEnqueueScheduleCounts({ postId: 'p1', ordinal: 0, eventName: `  A   "quoted"\nname ${'x'.repeat(80)}`, schedules: 3, bodyBytes: 1234 });
    const line = infos[0];
    assert.match(line, /^\[processAiJob\] enqueue post=p1 ordinal=0 name="A 'quoted' name x+\.\.\." schedules=3 bodyBytes=1234$/);
    const name = /name="([^"]*)"/.exec(line)?.[1] ?? '';
    assert.ok(name.length <= 63, `name too long: ${name.length}`);
  });

  await t.test('totals line sums per post', () => {
    logEnqueueTotals({ postId: 'p1', events: 6, modelSchedules: 16, enqueuedSchedules: 16 });
    assert.deepStrictEqual(infos, ['[processAiJob] enqueue-totals post=p1 events=6 modelSchedules=16 enqueuedSchedules=16']);
  });

  await t.test('insert path with equal counts logs one info line and no warning', () => {
    logIngestScheduleCounts({ path: 'insert', postId: 'p1', ordinal: 2, received: 10, sent: 10, inserted: 10 });
    assert.deepStrictEqual(infos, ['[ingestor] ingest-schedules path=insert post=p1 ordinal=2 received=10 sent=10 inserted=10']);
    assert.deepStrictEqual(warns, []);
  });

  await t.test('insert path with fewer rows inserted than sent warns once with both numbers', () => {
    logIngestScheduleCounts({ path: 'insert', postId: 'p1', ordinal: 0, received: 10, sent: 10, inserted: 2 });
    assert.strictEqual(infos.length, 1);
    assert.deepStrictEqual(warns, ['[ingestor] schedule-count-mismatch post=p1 ordinal=0 received=10 sent=10 inserted=2']);
  });

  await t.test('insert path warns when the message had more schedules than were sent to the insert', () => {
    logIngestScheduleCounts({ path: 'insert', postId: 'p1', ordinal: 0, received: 10, sent: 2, inserted: 2 });
    assert.deepStrictEqual(warns, ['[ingestor] schedule-count-mismatch post=p1 ordinal=0 received=10 sent=2 inserted=2']);
  });

  await t.test('zero schedules is a normal 0/0 line', () => {
    logIngestScheduleCounts({ path: 'insert', postId: 'p1', ordinal: 0, received: 0, sent: 0, inserted: 0 });
    assert.deepStrictEqual(warns, []);
    assert.match(infos[0], /sent=0 inserted=0/);
  });

  await t.test('enrich path logs incoming vs final and never warns, even when they differ', () => {
    logIngestScheduleCounts({ path: 'enrich', postId: 'p1', ordinal: 1, received: 4, incoming: 4, final: 7 });
    assert.deepStrictEqual(infos, ['[ingestor] ingest-schedules path=enrich post=p1 ordinal=1 received=4 incoming=4 final=7']);
    assert.deepStrictEqual(warns, []);
  });

  await t.test('a throwing logger is swallowed and never reaches the caller', () => {
    console.info = () => {
      throw new Error('logger down');
    };
    console.warn = () => {
      throw new Error('logger down');
    };
    assert.doesNotThrow(() => logExtractionScheduleCounts({ postId: 'p', eventIndex: 0, eventName: 'n', modelSchedules: 1, messageSchedules: 1 }));
    assert.doesNotThrow(() => logEnqueueScheduleCounts({ postId: 'p', ordinal: 0, eventName: 'n', schedules: 1, bodyBytes: 1 }));
    assert.doesNotThrow(() => logEnqueueTotals({ postId: 'p', events: 1, modelSchedules: 1, enqueuedSchedules: 1 }));
    assert.doesNotThrow(() => logIngestScheduleCounts({ path: 'insert', postId: 'p', ordinal: 0, received: 3, sent: 3, inserted: 1 }));
  });
});
