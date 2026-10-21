### bench: 30012 events, 22337 open; ladder sleman > yogyakarta > bantul, horizon 60 days

| K | form | median ms | rows returned | rows scanned | plan-guard |
|--:|---|--:|--:|--:|---|
| 300 | array overlap + OR | 5.2 | 300 | 4257 | ok |
| 300 | junction branches | 0.3 | 300 | 303 | ok |
| 1000 | array overlap + OR | 7.2 | 1000 | 4257 | ok |
| 1000 | junction branches | 4.8 | 1000 | 4257 | ok |
| 3000 | array overlap + OR | 6.5 | 3000 | 4257 | ok |
| 3000 | junction branches | 4.2 | 3000 | 4257 | ok |
| 10000 | array overlap + OR | 6.0 | 4257 | 4257 | ok |
| 10000 | junction branches | 5.9 | 4257 | 4257 | ok |
