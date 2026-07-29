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

The backend lives in `apps/backend` and is built with TypeScript. It exposes a single GraphQL endpoint (`POST /graphql`) backed by Drizzle ORM/Postgres, following the Unified Query DSL defined in the architecture spine.

### Local Development

1.  **Configure environment:**
    Ensure `DATABASE_URL` is set in the root `.env` (see Section 3). Optionally override `BACKEND_PORT` (defaults to `4001`).
2.  **Run the local dev server:**
    From the repo root: `pnpm --filter @festgrid/backend dev` (or `pnpm dev` to run all apps via Turborepo).
    This starts a plain Node HTTP server at `http://localhost:4001/graphql` that reuses the exact same request-handling code as the Lambda handler.
3.  **How `apps/web` reaches it:**
    The Next.js route handler at `apps/web/src/app/api/events` proxies GraphQL requests to `BACKEND_GRAPHQL_URL` (defaults to `http://localhost:4001/graphql`), so the browser never talks to the backend directly.

### Production Deployment (Not Yet Automated)

*   An AWS account and AWS CLI configured.
*   Serverless Framework (or AWS CDK/SAM) installed: `npm install -g serverless`

The Lambda entry point already exists at `apps/backend/src/handler.ts` (exported as `handler`), written against the API Gateway HTTP API (`APIGatewayProxyEventV2`) event shape. What's still needed:

1.  **Infrastructure-as-code:** Add a `serverless.yml` (or CDK/SAM stack) under `apps/backend` defining the API Gateway HTTP API route (`POST /graphql`), the Lambda function (pointing at the compiled `dist/handler.js`), and the `DATABASE_URL`/`CORS_ALLOWED_ORIGIN` environment variables.
2.  **Deployment:** `cd apps/backend && pnpm run build && pnpm exec serverless deploy`.
3.  **Wire up `BACKEND_GRAPHQL_URL`:** Point the Vercel-deployed `apps/web` at the deployed API Gateway URL.

Separate Lambda functions for the Scraper, AI Processor, and Ingestor (and their SQS queues) are still out of scope until the Epic 3 stories that require them.


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
3.  **Configure CI/CD:**
    Add the Supabase connection string to your CI/CD environment variables as `DATABASE_URL`.
4.  **Deployment:**
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

This walkthrough provides a high-level overview of the setup process. For detailed configuration and implementation, refer to the official documentation of each service.
