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

The backend is built with TypeScript on a serverless architecture using AWS.

### Prerequisites

*   An AWS account.
*   AWS CLI installed and configured.
*   Serverless Framework installed: `npm install -g serverless`

### Setup Steps

1.  **Create a new Serverless project:**

    ```bash
    serverless create --template aws-nodejs-typescript --path backend
    cd backend
    ```

2.  **Project Structure:**

    Your `serverless.yml` file will define the AWS resources (API Gateway, Lambda, SQS, EventBridge). You will need to create separate Lambda functions for:

    *   API Logic
    *   Scraper
    *   AI Processor
    *   Ingestor

3.  **Install dependencies:**

    ```bash
    npm install
    npm install aws-sdk
    ```

4.  **Implement the Unified Query DSL:**

    In your API Logic Lambda, you will need to implement the logic to parse and handle the Unified Query DSL defined in the architecture spine.

5.  **Deployment:**

    *   Deploy the service to AWS: `serverless deploy`

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

FCM is used for sending push notifications.

### Setup Steps

1.  **Create a Firebase project:**

    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.

2.  **Get API Key:**

    *   In your Firebase project settings, find your Server key.

3.  **Integrate with Backend:**

    *   Use an FCM library for Node.js (e.g., `fcm-node`) in your AWS Lambda functions to send notifications using the API key.

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

This walkthrough provides a high-level overview of the setup process. For detailed configuration and implementation, refer to the official documentation of each service.
