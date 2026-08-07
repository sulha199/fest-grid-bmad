# 6. Outbound Email

*   **Service:** **Amazon Simple Email Service (SES)**
*   **Description:** A cost-effective, flexible, and scalable email service.
*   **Reasoning:** Consistent with the project's AWS-only, zero-extra-account philosophy — no third-party account (SendGrid, Postmark, etc.) is needed, and SES integrates directly with the same IAM and Lambda execution roles already used by the API lambda.
