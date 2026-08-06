# High-Level Overview

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
        Geoapify[Geoapify]
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
    L_API -- resolves location via --> Geoapify

    U -- loads map tiles from --> Geoapify
```

