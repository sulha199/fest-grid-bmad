# Deferred push: GitHub workflow files

Story 9.7 adds `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`.
The cloud session's GitHub token lacks the `workflow` OAuth scope, so GitHub rejects any push that
creates or updates a workflow file ("refusing to allow an OAuth App to create or update workflow ...").

The file is kept locally (excluded via `.git/info/exclude`) and a copy is stored here as
`ai-filter-golden-prompt-nightly-eval.yml.txt`. To land it, a human with workflow scope should copy it to
`.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` and push. Review it first: once on the default
branch it runs nightly and calls the live Gemini API with `SYSTEM_GEMINI_API_KEY`.
