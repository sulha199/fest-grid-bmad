# 2. Backend

The backend is built entirely with TypeScript on a serverless architecture using AWS.

*   **API Layer:**
    *   **Service:** **Amazon API Gateway**.
    *   **Description:** This layer exposes the backend logic to the frontend.
    *   **Reasoning:** Amazon API Gateway is a feature-rich, providing crucial capabilities like request validation, authentication, and, most importantly, **native throttling and rate limiting**. These features are essential for fulfilling the requirements in Section 3.8 of the PRD to protect the backend and the Gemini API from abuse. The AWS Free Tier includes 1 million API calls per month for the first 12 months.

*   **Compute Layer (Business Logic, Workers):**
    *   **Service:** **AWS Lambda** (Node.js runtime)
    *   **Description:** All backend logic, from handling API requests to scraping and AI processing, will be implemented as TypeScript functions running on AWS Lambda.
    *   **Reasoning:** Lambda is the core of the serverless architecture. It's highly scalable, cost-effective (with a permanent free tier of 1 million requests per month), and eliminates server management.

*   **Queuing System:**
    *   **Service:** **Amazon SQS (Simple Queue Service)**
    *   **Description:** SQS will manage the `ScrapingQueue`, `AIProcessingQueue`, and `DataIngestionQueue`, decoupling the different parts of the event processing pipeline.
    *   **Reasoning:** SQS is designed for building resilient, distributed systems. It's perfect for managing the flow of tasks between the different Lambda functions in the pipeline and has a generous permanent free tier (1 million requests per month).

*   **Scheduled Tasks (Cron Jobs):**
    *   **Service:** **Amazon EventBridge**
    *   **Description:** EventBridge will be used to trigger the scraping Lambda function on a recurring schedule.
    *   **Reasoning:** EventBridge is a reliable and flexible service for scheduling events and has a free tier that will cover the project's needs.

*   **Direct Lambda Invoke (scoped exception to the three-queue rule) — manual "AI-Assisted Correction" extraction (Story 4.2b):**
    *   **Service:** **AWS Lambda asynchronous invoke** (`InvocationType: 'Event'`) from the API Lambda to the AI Lambda, tracked in the `manual_extraction_jobs` table (polled via `Query.extractionJob`).
    *   **Description:** After its synchronous pre-checks, `extractEventDataFromUrl` inserts a job row and async-invokes the AI Lambda with `{ jobType: 'manual-extraction', jobId }`. The AI Lambda (the only Lambda bundling the image-processing runtime for the pre-AI face blur, Story 3.20) claims the row atomically, builds the Gemini request with the blur, and writes the result. IaC: `aiProcessorLambda.grantInvoke(apiLambda)`, `AI_PROCESSOR_FUNCTION_NAME` on the API Lambda, and `configureAsyncInvoke({ retryAttempts: 0 })` on the AI Lambda.
    *   **Reasoning:** In prod the AI Lambda has no SQS trigger (only a 5-minute EventBridge poll-and-drain), so routing a user-attended request through `AIProcessingQueue` would mean up to ~5 minutes of waiting (more behind a bulk-scrape backlog). The job writes no `posts`/`events` rows and is not pipeline work, so this is **not** a precedent for pipeline work, which must still go through the queues. A non-terminal job older than 5 minutes is reported `FAILED` lazily when polled; no sweep cron is needed.
