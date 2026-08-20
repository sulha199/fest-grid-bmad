# Test Automation Summary

## Generated Tests

### E2E Tests
- [x] `apps/web/e2e/actor-runs.spec.ts` - Moderator opens the profile menu, navigates to Scraper Runs, filters by Apify, expands the deterministic stored run, and replays it.

## Test Data
- [x] `packages/database/seed.ts` - Adds `E2E-ACTOR-RUN-001`, a stored-output Apify run whose replay idempotently reports zero recovered posts without a vendor API call.

## Validation
- [x] Editor diagnostics report no errors in the E2E spec or seed change.
- [ ] Playwright execution requires `E2E_AUTH_STORAGE_STATE` containing an authenticated moderator session. The spec deliberately skips when it is absent, matching the existing privileged E2E test convention.

## Next Steps
- Provide `E2E_AUTH_STORAGE_STATE` for a moderator account and run `pnpm --filter web test:e2e -- e2e/actor-runs.spec.ts`.
- Run code review after the privileged E2E flow is proven green.
