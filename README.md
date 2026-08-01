# FestGrid

## Runtime Validation

- **Backend (apps/backend):** Uses [AJV](https://ajv.js.org/) to validate external/untrusted data at the backend boundary (e.g. scraped posts, AI-extraction payloads). This uses JSON Schema and compiled validators.
- **Frontend (apps/web):** Uses [Zod](https://zod.dev/) to validate client-side data/forms at the frontend boundary (schema + `safeParse`).
- **Isolation:** The two validation libraries are never mixed in a shared package. `ajv` is strict to `apps/backend` and `zod` is strict to `apps/web`. For more details, see the "Runtime Schema Validation" rule in `_bmad-output/project-context.md`.
