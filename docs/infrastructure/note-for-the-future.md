# Note for the Future

This serverless stack perfectly aligns with the technical and performance demands of the FestGrid PRD. To keep it as free and compliant as possible long-term, you should swap Vercel for Cloudflare Pages (to avoid commercial restrictions) and plan to either absorb the minor cost of API Gateway after year one, or swap to AWS Lambda Function URLs (which are completely free permanently but lack the native throttling features required in PRD Section 3.8).
