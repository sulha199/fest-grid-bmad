# FestGrid Infrastructure Architecture

This document outlines the infrastructure architecture for the FestGrid application, designed to be scalable, resilient, and cost-effective, leveraging free tiers as much as possible for long-term sustainability.

## High-Level Overview

The architecture is based on a serverless model using AWS for the backend, Vercel for the frontend, and Supabase for the database. This approach minimizes infrastructure management overhead and allows for a "pay-as-you-go" model that is highly cost-effective, especially in the early stages of the project.

```mermaid
graph TD
    subgraph User
        U[User's Browser]
    end

    subgraph Vercel
        V[Vercel]
    end

    subgraph "AWS (Serverless Backend)"
        subgraph API
            direction LR
            APIGW[Amazon API Gateway]
        end
        
        subgraph Processing
            direction TB
            L_API[Lambda: API Logic]
            L_Scrape[Lambda: Scraper]
            L_AI[Lambda: AI Processor]
            L_Ingest[Lambda: Ingestor]
        end

        subgraph Queues
            direction TB
            SQS_Scrape[SQS: ScrapingQueue]
            SQS_AI[SQS: AIProcessingQueue]
            SQS_Ingest[SQS: DataIngestionQueue]
        end

        subgraph Cron
            EventBridge[EventBridge]
        end
    end

    subgraph External Services
        Supabase[Supabase (PostgreSQL)]
        FCM[Firebase Cloud Messaging]
        Gemini[Google Gemini API]
    end

    U --> V
    V --> APIGW
    
    APIGW --> L_API

    EventBridge -- triggers --> L_Scrape
    L_Scrape -- enqueues --> SQS_Scrape
    SQS_Scrape -- triggers --> L_Scrape
    L_Scrape -- enqueues --> SQS_AI

    SQS_AI -- triggers --> L_AI
    L_AI -- uses --> Gemini
    L_AI -- enqueues --> SQS_Ingest

    SQS_Ingest -- triggers --> L_Ingest
    L_Ingest -- writes to --> Supabase

    L_API -- interacts with --> Supabase
    L_API -- sends to --> FCM
```

## Component Breakdown

### 1. Frontend

*   **Service:** **Vercel**
*   **Description:** The frontend is a React application built with TypeScript. It will be hosted on Vercel.
*   **Reasoning:** Vercel is the ideal platform for your React frontend. It offers a seamless Git-based workflow, automatic deployments, a global CDN, and a generous free tier that is perfect for a project like yours.

### 2. Backend

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

### 3. Database

*   **Service:** **Supabase** (PostgreSQL)
*   **Description:** A managed PostgreSQL database.
*   **Reasoning:** Supabase provides a generous free tier for its PostgreSQL database, along with other useful features like authentication and storage. It's a more sustainable long-term free option compared to the 12-month free tiers of some cloud providers.

### 4. Push Notifications

*   **Service:** **Firebase Cloud Messaging (FCM)**
*   **Description:** A cross-platform messaging solution.
*   **Reasoning:** FCM is the industry standard for push notifications. It's free, reliable, and provides everything needed to send notifications to the PWA.

---

### Note for the Future

This serverless stack perfectly aligns with the technical and performance demands of the FestGrid PRD. To keep it as free and compliant as possible long-term, you should swap Vercel for Cloudflare Pages (to avoid commercial restrictions) and plan to either absorb the minor cost of API Gateway after year one, or swap to AWS Lambda Function URLs (which are completely free permanently but lack the native throttling features required in PRD Section 3.8).
