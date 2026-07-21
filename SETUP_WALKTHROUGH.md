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

5.  **Deployment:**

    *   Deploy to Vercel: `vercel --prod`

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

## 3. Database (Supabase)

The database is a managed PostgreSQL instance from Supabase.

### Setup Steps

1.  **Create a new Supabase project:**

    *   Go to [supabase.com](https://supabase.com/) and create a new project.

2.  **Get Database Credentials:**

    *   In your Supabase project dashboard, go to `Settings` -> `Database` and find your connection string.

3.  **Connect from Backend:**

    *   Use a PostgreSQL client library for Node.js (e.g., `pg`) in your AWS Lambda functions to connect to the Supabase database using the credentials from the previous step.

## 4. Push Notifications (Firebase Cloud Messaging)

FCM is used for sending push notifications.

### Setup Steps

1.  **Create a Firebase project:**

    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.

2.  **Get API Key:**

    *   In your Firebase project settings, find your Server key.

3.  **Integrate with Backend:**

    *   Use an FCM library for Node.js (e.g., `fcm-node`) in your AWS Lambda functions to send notifications using the API key.

This walkthrough provides a high-level overview of the setup process. For detailed configuration and implementation, refer to the official documentation of each service.