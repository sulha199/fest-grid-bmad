import { defineConfig, mergeConfig } from 'vitest/config';
import reactConfig from '@festgrid/testing-config/vitest-react';
import react from '@vitejs/plugin-react';

export default mergeConfig(
  reactConfig,
  defineConfig({
    plugins: [react()],
    test: {
      // jsdom component tests (the weekly calendar paging ones render 20-25 events several times)
      // take ~1 s locally but run 5-7x slower on a shared CI runner, where Turbo executes the other
      // packages' suites at the same time. At vitest's 5 s default they timed out under that load
      // (CI run 39899274665 and 39943272909) even though they are synchronous and pass. A realistic
      // budget keeps every test running while a CPU-starved runner no longer turns slow into failed.
      testTimeout: 20_000,
      // FIND-062: isEventEnded's shared ended-cases.ts fixture (packages/domain) is deliberately
      // asserted with timezone: undefined (see format-event-date.ts's zonedTimeToUtc -- "no
      // explicit timezone to target" falls back to the RUNNING PROCESS's own local system
      // timezone, by design -- see 0-i5d's Dev Notes "Timezone scope of the !ended mirror" for
      // why that is the correct production behavior, not a bug). The fixture's `now` values are
      // UTC ISO strings, so the fixture itself is only deterministic when this test process's
      // local timezone IS UTC. Pinning it here (rather than changing the production function's
      // behavior, which Dev Notes documents as intentional) is FIND-062's own suggested fix,
      // confirmed to resolve the failure locally (non-UTC dev machine) without affecting runtime
      // behavior anywhere else.
      //
      // `FESTGRID_TEST_TZ` is the one sanctioned override (`pnpm test:tz` sets it to a handful of
      // non-UTC DEVICE timezones to prove the timezone suites don't depend on the machine). A
      // plain `TZ=... vitest` is ignored on purpose -- this block would overwrite it, which is how
      // an earlier `test:tz` ran every "device timezone" as UTC without anyone noticing.
      env: {
        TZ: process.env.FESTGRID_TEST_TZ ?? 'UTC',
      },
    },
  })
);
