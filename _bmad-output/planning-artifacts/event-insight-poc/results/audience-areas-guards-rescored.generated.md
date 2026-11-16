# Audience-area guards, re-scored offline (generated)

| results file | runs | raw fully correct | guarded fully correct | raw wrong geoScope | guarded wrong geoScope | guard actions |
|---|--:|--:|--:|--:|--:|--:|
| audience-areas-v1-core.json | 60 | 50/60 | 52/60 | 4 | 2 | 4 |
| audience-areas-v2-core.json | 60 | 57/60 | 57/60 | 0 | 0 | 0 |
| audience-areas-v1-holdout.json | 18 | 12/18 | 15/18 | 3 | 0 | 3 |
| audience-areas-v2-holdout.json | 18 | 18/18 | 18/18 | 0 | 0 | 0 |

### Guard actions

- audience-areas-v1-core.json syn-pameran-origin run 1: national without nationwide wording -> unspecified (raw fail -> guarded fail)
- audience-areas-v1-core.json syn-pameran-origin run 3: national without nationwide wording -> unspecified (raw fail -> guarded fail)
- audience-areas-v1-core.json ar-no-area-curator run 1: national without nationwide wording -> unspecified (raw fail -> guarded pass)
- audience-areas-v1-core.json ar-no-area-curator run 2: national without nationwide wording -> unspecified (raw fail -> guarded pass)
- audience-areas-v1-holdout.json hd-no-place-curator run 1: national without nationwide wording -> unspecified (raw fail -> guarded pass)
- audience-areas-v1-holdout.json hd-no-place-curator run 2: national without nationwide wording -> unspecified (raw fail -> guarded pass)
- audience-areas-v1-holdout.json hd-no-place-curator run 3: national without nationwide wording -> unspecified (raw fail -> guarded pass)
