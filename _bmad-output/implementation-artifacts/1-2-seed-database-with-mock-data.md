# Story 1.2: Seed database with mock data

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.2
- **Status:** ready-for-dev

## User Story
**As a** developer,
**I want** to have a script that seeds the database with mock event data,
**So that** I can develop and test the event discovery features with realistic data.

## Acceptance Criteria
*   **Given** the database schema is set up,
*   **And** we have a defined set of mock data including locations, Instagram post URLs, image URLs, and SocialMediaAccountProfile data,
*   **And** all foreign key relationships in the mock EventInfo data are populated with corresponding mock data,
*   **When** I run the seed script,
*   **Then** the database is populated with a set of mock events, including names, dates, locations, schedules, performers, and all related nested data.

## Developer Context

### Architecture & Technical Requirements
- **Database Access (Drizzle ORM):** The seed script **must** use Drizzle ORM to insert data into the PostgreSQL database. Do not use raw SQL or the Supabase client.
- **Seeding Script Location:** Create a seed script (e.g., `packages/database/src/seed.ts`) and add a corresponding `seed` command to `packages/database/package.json` (e.g., `"seed": "tsx src/seed.ts"`).
- **Data Generation:** 
  - Ensure the mock data spans various scenarios: ongoing events, upcoming events, and past events to properly test filtering logic later.
  - Generate UUIDs for primary keys where needed if not relying entirely on Postgres `defaultRandom()`. 
  - Generate unique `slug` strings for `events` and `schedules` using a library like `nanoid`.
- **Database Clean-up:** The seed script should handle clearing existing data safely before insertion to ensure idempotency.
- **Realistic Data:** Mock data must be realistic. Include mock user accounts, locations, mock Instagram post URLs, and associated social media profile data to accurately reflect the application's domain logic.
- **Environment Configuration:** The seed script should utilize the `DATABASE_URL` from `packages/database/.env` for local seeding.

### Previous Story Intelligence
- **From Story 1.1:** Drizzle schema tables will include `events`, `schedules`, `users`, `user_locations`, `subscriptions`, and `api_keys`. They utilize specific Postgres types from `drizzle-orm/pg-core` (like `uuid`, `timestamp` with timezone).
- Note that Story 1.1 (schema creation) will be completed prior to running this seed script.

### File Structure Requirements
- `packages/database/src/seed.ts` (or similar): The actual seeding logic.
- `packages/database/package.json`: Update scripts to include `"seed"`.

### Project Context Reference
- Ensure all code strictly follows the TypeScript configurations from `@festgrid/typescript-config`.
- Avoid hardcoding fallback default credentials in the code. Ensure everything relies on environment variables safely.

## Completion Status
*   Status: ready-for-dev
*   Ultimate context engine analysis completed - comprehensive developer guide created.