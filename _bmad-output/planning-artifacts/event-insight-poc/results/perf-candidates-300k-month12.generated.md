### bench300: 300012 events, 22196 open; ladder sleman > yogyakarta > bantul, horizon 60 days

| K | form | median ms | rows returned | rows scanned | plan-guard |
|--:|---|--:|--:|--:|---|
| 300 | array overlap + OR | 6.6 | 300 | 4233 | ok |
| 300 | junction branches | 0.3 | 300 | 303 | ok |
| 1000 | array overlap + OR | 5.0 | 1000 | 4233 | ok |
| 1000 | junction branches | 1.2 | 1000 | 1905 | ok |
| 3000 | array overlap + OR | 5.6 | 3000 | 4233 | ok |
| 3000 | junction branches | 2.1 | 3000 | 3343 | ok |
| 10000 | array overlap + OR | 6.9 | 4233 | 4233 | ok |
| 10000 | junction branches | 3.2 | 4233 | 4233 | ok |
