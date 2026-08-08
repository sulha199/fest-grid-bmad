# FestGrid Source Code Setup Walkthrough

This document provides a step-by-step guide to setting up the source code for the different components of the FestGrid application.

## 1. Frontend (Vercel)

The frontend is a React application built with TypeScript and hosted on Vercel.

### Prerequisites

*   Node.js and npm installed.
*   A Vercel account.

### Setup Steps

1.  **Create a new React project:**

    ```bash
    npx create-react-app frontend --template typescript
    cd frontend
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Connect to Vercel:**

    *   Install the Vercel CLI: `npm install -g vercel`
    *   Login to your Vercel account: `vercel login`
    *   Link the project: `vercel link`

4.  **Development:**

    *   Run the development server: `npm start`

### Vercel Deployment Setup (Manual Step)

Since Vercel natively integrates with GitHub for Continuous Deployment (CD), you must manually link the GitHub repository to a Vercel project:
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Select this GitHub repository (`festgrid`) from your connected Git provider.
4. Select `apps/web` as the **Root Directory**. (Vercel will automatically detect that this is part of a larger monorepo).
5. Set the Framework Preset to **Next.js**.
6. **Important**: Do NOT override the Build Command or Install Command. Leave them as their defaults. Vercel natively understands Turborepo and `pnpm` workspaces; it will automatically install dependencies at the repository root and use turbo to build the project.
7. Click **Deploy**. Future pushes to the `main` branch will automatically trigger a new deployment.

## 2. Backend (AWS Serverless)

The backend is built with TypeScript on a serverless architecture using AWS and is provisioned via the AWS Cloud Development Kit (CDK).

### Prerequisites

* An AWS account.
* AWS CLI installed and configured with appropriate IAM permissions.
* The AWS CDK CLI installed globally: `npm install -g aws-cdk`

### Setup Steps

1. **One-Time AWS CDK Bootstrapping:**

   Before you can deploy any CDK stacks to your AWS account/region, you must bootstrap the environment. Run the following command from the repository root:

   ```bash
   pnpm --filter infrastructure exec cdk bootstrap
   ```

2. **Stack Environments:**

   The infrastructure is parameterized by environment stages: `dev`, `staging`, and `prod`. Each stack instance uses the same configuration template, with resource names suffixed to avoid collisions (e.g., `FestgridBackendStack-dev`, `FestgridBackendStack-staging`, `FestgridBackendStack-prod`).

3. **Deploying a Local Development Stack:**

   To deploy your personal development stack for testing, run:

   ```bash
   pnpm --filter infrastructure exec cdk deploy FestgridBackendStack-dev
   ```

4. **CI/CD Configuration (GitHub Actions):**

   On merge/push to the `main` branch, the `deploy-infrastructure` job automatically deploys the `prod` stack (`FestgridBackendStack-prod`).

   To enable this, make sure the following repository secrets are configured in GitHub Actions:
   * `AWS_ACCESS_KEY_ID`: Your AWS access key with deployment permissions.
   * `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key.
   * `DATABASE_URL`: The production Supabase database connection string (injected into `L_API` and `L_Ingest` at deployment time).

## 3. Database (Drizzle ORM, Local Postgres & Supabase)

The database schemas are managed code-first using Drizzle ORM in the `packages/database` workspace. The project utilizes a dual environment setup:

### Local Development (PostgreSQL)

1.  **Start a Local Postgres Instance:**
    Ensure you have a PostgreSQL database running locally (e.g., via Docker or native installation).
    *Tip: You may need to create the database first using `createdb festgrid` or via your Postgres client.*
2.  **Configure Environment:**
    Set your `DATABASE_URL` in `packages/database/.env` (e.g., `postgresql://postgres:postgres@localhost:5432/festgrid`).
3.  **Generate and Run Migrations:**
    Run `pnpm --filter @festgrid/database generate` to generate migration files.
    Run `pnpm --filter @festgrid/database migrate` to apply migrations to your local database.

### Production (Supabase Cloud)

1.  **Create a new Supabase project:**
    Go to [supabase.com](https://supabase.com/) and create a new project.
2.  **Get Database Credentials:**
    In your Supabase project dashboard, go to `Settings` -> `Database` and find your production connection string.
3.  **Find your Project URL:**
    Go to `Settings` -> `API` -> `Project URL`. Copy this URL and set it as `SUPABASE_URL` in your environment (used for JWT verification). Also use this URL for `NEXT_PUBLIC_SUPABASE_URL` on the frontend.
4.  **Get Project API Keys:**
    Go to `Settings` -> `API` -> `Project API keys` -> `anon public`. Copy this key and set it as `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your frontend environment variables.
5.  **Configure Google OAuth Provider:**
    *   Enable the Google provider in the Supabase Dashboard under `Authentication` -> `Providers` -> `Google`.
    *   Create a Google Cloud Console OAuth Client ID and Client Secret.
    *   Set the Authorized redirect URI in the Google Cloud Console to `{SUPABASE_URL}/auth/v1/callback` (replace `{SUPABASE_URL}` with your actual Supabase Project URL).
    *   Copy the Client ID and Client Secret into the Supabase Google Provider configuration and save.
6.  **Configure CI/CD:**
    Add the Supabase connection string to your CI/CD environment variables as `DATABASE_URL`.
7.  **Deployment:**
    The CI/CD pipeline runs `drizzle-kit` to automatically apply the generated SQL migration files directly to the Supabase Postgres instance upon deployment.

## 4. Push Notifications (Firebase Cloud Messaging)

FCM is used for sending and receiving push notifications securely. It integrates the Firebase Admin SDK on the backend and the Firebase JS client SDK on the web app.

### Setup Steps

1. **Create a Firebase project:**
   * Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.

2. **Generate Backend Service Account Credentials (Firebase Admin):**
   * Go to **Project Settings** -> **Service Accounts**.
   * Click **Generate new private key**. This downloads a JSON file containing your service account credentials.
   * Map these values to your backend environment variables in `.env`:
     * `FIREBASE_PROJECT_ID`: The `project_id` from the downloaded JSON.
     * `FIREBASE_CLIENT_EMAIL`: The `client_email` from the downloaded JSON.
     * `FIREBASE_PRIVATE_KEY`: The `private_key` from the downloaded JSON. (Make sure newlines are formatted or escaped correctly; the backend code handles unescaping single-line PEM keys).

3. **Get Frontend Client Configuration (Firebase JS SDK):**
   * Go to **Project Settings** -> **General**.
   * Under **Your apps**, click the web icon (`</>`) to register a new Web App.
   * Copy the configuration object and map the values to these variables in `.env`:
     * `NEXT_PUBLIC_FIREBASE_API_KEY`
     * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     * `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     * `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     * `NEXT_PUBLIC_FIREBASE_APP_ID`

4. **Generate Web Push Certificate Key (VAPID Key):**
   * Go to **Project Settings** -> **Cloud Messaging**.
   * Under the **Web configuration** tab, find **Web Push certificates** and click **Generate key pair**.
   * Copy the generated key pair string and set it as:
     * `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

5. **Client Registration and Permission:**
   * The client registers a service worker (`/firebase-messaging-sw.js`) and requests user permission to receive notifications. Upon permission approval, the client SDK retrieves a unique registration token that can be mapped and saved for push delivery.

## 5. Analytics (PostHog)

PostHog is used for tracking user interactions, page views, and core events across the application.

### Setup Steps

1.  **Create a PostHog project:**
    *   Sign up at [posthog.com](https://posthog.com) and create a new organization/project.
2.  **Get Project API Key and Host:**
    *   In your PostHog dashboard, navigate to **Project Settings**.
    *   Copy your "Project API Key" (starts with `phc_`).
    *   Note your Instance address (e.g., `https://us.i.posthog.com`).
3.  **Configure Local Environment:**
    *   Open the root `.env` file and set the keys:
        ```env
        DATABASE_URL="postgresql://postgres:postgres@localhost:5432/festgrid"
        NEXT_PUBLIC_POSTHOG_KEY="your_api_key"
        NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
        NEXT_PUBLIC_POSTHOG_DEFAULTS="2026-05-30"
        ```
    *   `NEXT_PUBLIC_POSTHOG_DEFAULTS` is required and used directly by PostHog initialization.
    *   Local package-level `.env` files are optional and should only contain overrides for root `.env` values.
    *   *(Note: Local analytics initialization safely skips if these keys are missing to prevent errors during local development).*

## 6. Geolocation Adapter (Geoapify)

Geoapify provides both the backend-only address, place, and coordinate resolution, as well as the frontend interactive map tiles.

### Setup Steps

1.  **Create a Geoapify project:**
    *   Sign up at [Geoapify MyProjects](https://myprojects.geoapify.com/) (no credit card required for the free tier) and create a project.
2.  **Generate Backend API Key:**
    *   Generate a dedicated API key for backend, server-to-server geocoding.
    *   *Note: While the PRD requires API key restriction via domain/IP referrer restrictions in the Geoapify dashboard, neither option meaningfully secures a server-to-server Lambda call today without a static outbound IP (NAT Gateway). For MVP, this key is used unrestricted, and this security-posture trade-off is accepted.*
    *   Add the key to your root `.env` file as `GEOAPIFY_API_KEY`. (It does not get a `NEXT_PUBLIC_` prefix since the key is strictly backend-only).
3.  **Generate Frontend Maps API Key:**
    *   Generate a second, separate API key within the same project for loading MapLibre interactive map tiles.
    *   Under key restrictions in the Geoapify MyProjects dashboard, enable **HTTP Referrer Restrictions** and add your application's allowed domain names (e.g. `http://localhost:3000` for local development, and your production domains). This meaningfully secures the key since it is called directly from users' browsers.
    *   Add this key to your root `.env` and `apps/web/.env` files as `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY`.

## 7. Outbound Email Adapter (Amazon SES)

Amazon SES is used for transactional email delivery (quota warnings, moderator alerts, invalid key notifications).

### Setup Steps

1.  **Verify your Sending Domain:**
    *   Log in to the [AWS Management Console](https://console.aws.amazon.com/) and navigate to the **Amazon SES** console.
    *   Under **Verified identities**, click **Create identity** and select **Domain**.
    *   Enter your sending domain (e.g., `festdaily.app` or your sub-domain).
    *   Choose **Easy DKIM** and set the DKIM signing key length to **1024-bit** or **2048-bit** (CDK is configured for SHA256 1024-bit).
    *   Click **Create identity**.
2.  **Add DNS Records:**
    *   Copy the generated DKIM CNAME records shown in the SES console (also outputted by the CDK stack's `EmailIdentityDkimTokens` output).
    *   Log in to your DNS provider (e.g., Route 53, Cloudflare, Namecheap) and add these CNAME records to your domain's DNS settings.
    *   Wait for AWS SES to verify the domain (usually takes a few minutes but can take up to 72 hours).
3.  **Request Production Access (Move out of Sandbox):**
    *   By default, all new SES accounts are in a "sandbox" mode, which restricts sending to only pre-verified recipient addresses.
    *   To send emails to arbitrary users, navigate to the SES dashboard, click **Request production access**, fill out the application detailing your transactional send case, and submit the AWS Support request.
4.  **Configure Environment Variables:**
    *   Add your verified sending email address to your root `.env`:
        ```env
        SES_FROM_EMAIL_ADDRESS="notifications@festdaily.app"
        SYSTEM_ERROR_ALERT_EMAIL="admin@festdaily.app"
        ```
    *   *Note: `SYSTEM_ERROR_ALERT_EMAIL` is the developer/administrator inbox that receives `reportSystemError` alerts. While the SES account remains in sandbox mode, this address must be verified as a recipient in the AWS SES console.*
    *   *Note: Sending in `adapter.ts` is skipped in favor of a console log when `SES_FROM_EMAIL_ADDRESS` is omitted or when `NODE_ENV === 'test'` — this entire section's setup steps are optional for local development.*

## 8. AI Gateway (Google Gemini API)

The AI Gateway wraps all outbound Google Gemini API calls behind a single Adapter interface with rate-limiting, key-management (BYOK), and decryption guarantees.

### Setup Steps

1.  **Obtain a Gemini API Key:**
    *   Sign up at [Google AI Studio](https://aistudio.google.com/) and create a free-tier Gemini API key. This personal test key is used for local testing of the Adapter.
2.  **Configure Environment Variables:**
    *   Set the relevant environment variables in your root `.env`:
        ```env
        BYOK_KMS_KEY_ID="" # Provisioned automatically by Story 0.14's AWS IaC stack
        GEMINI_MODEL="gemini-2.5-flash"
        API_KEY_INVALID_ATTEMPTS_THRESHOLD="5"
        API_KEY_USAGE_CYCLE_DAYS="30"
        ```
    *   *Note: Decryption in `kms.ts` is lazily initialized and mocked locally/in test environments if `BYOK_KMS_KEY_ID` is omitted or when `NODE_ENV === 'test'`.*

## 9. Scraper Adapter (Apify)

Apify's `apify/instagram-scraper` actor is the concrete Instagram `ScraperAdapter` implementation (Story 3.4). This is a single, **app-funded** credential the application itself owns and pays for — never a per-user BYOK key, unlike the Gemini setup above.

### Setup Steps

1.  **Obtain an Apify API Token:**
    *   Sign up at [Apify Console](https://console.apify.com/) (no credit card required for the free plan — $5.00/month in prepaid usage credit, resets monthly, does not roll over).
    *   Generate a personal API token under **Settings → Integrations**.
    *   Add it to your root `.env` as `APIFY_API_TOKEN`.
2.  **Configure Environment Variables:**
    *   Set the relevant environment variables in your root `.env`:
        ```env
        APIFY_API_TOKEN=""
        SCRAPE_RESULTS_LIMIT="10"
        SCRAPE_INITIAL_LOOKBACK_DAYS="7"
        SCRAPE_SKIP_RECENT_HOURS="20"
        SCRAPER_MONTHLY_BUDGET_USD="5.00"
        SCRAPER_PRICE_PER_1000_ITEMS_USD="2.70"
        SCRAPER_CAPACITY_THRESHOLD_RATIO="0.9"
        SCRAPER_USAGE_CYCLE_DAYS="30"
        ```
    *   *Note: `SCRAPER_MONTHLY_BUDGET_USD`/`SCRAPER_PRICE_PER_1000_ITEMS_USD` reflect Apify's free-plan pricing as confirmed on 2026-08-08 — revisit these values if Apify changes its pricing. `SCRAPER_CAPACITY_THRESHOLD_RATIO` (default 90%) is the fraction of the free-tier budget the app will actually use before pausing new subscriptions/scrapes (Story 3.4's capacity gate) — intentionally leaves headroom rather than running right up to the vendor's hard limit.*
    *   *Note: If `APIFY_API_TOKEN` is omitted, the adapter's real calls will fail — there is currently no local-dev stub for this adapter (unlike the outbound email adapter, Story 0.15a); local development against real scraping requires a real token.*

This walkthrough provides a high-level overview of the setup process. For detailed configuration and implementation, refer to the official documentation of each service.
