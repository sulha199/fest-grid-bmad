### bench120: 120012 events, 13394 open; ladder sleman > yogyakarta > bantul, horizon 60 days

| K | form | median ms | rows returned | rows scanned | plan-guard |
|--:|---|--:|--:|--:|---|
| 300 | array overlap + OR | 3.0 | 300 | 2542 | ok |
| 300 | junction branches | 2.6 | 300 | 2542 | ok |
| 1000 | array overlap + OR | 5.1 | 1000 | 2542 | ok |
| 1000 | junction branches | 2.6 | 1000 | 2542 | ok |
| 3000 | array overlap + OR | 3.9 | 2542 | 2542 | ok |
| 3000 | junction branches | 2.7 | 2542 | 2542 | ok |
| 10000 | array overlap + OR | 3.4 | 2542 | 2542 | ok |
| 10000 | junction branches | 2.7 | 2542 | 2542 | ok |
