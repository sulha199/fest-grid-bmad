### bench120 all open (91k open): 120012 events, 90907 open; ladder sleman > yogyakarta > bantul, horizon 60 days

| K | form | median ms | rows returned | rows scanned | plan-guard |
|--:|---|--:|--:|--:|---|
| 300 | array overlap + OR | 0.8 | 300 | 300 | ok |
| 300 | junction branches | 0.3 | 300 | 303 | ok |
| 1000 | array overlap + OR | 27.9 | 1000 | 16845 | scanned-budget |
| 1000 | junction branches | 0.7 | 1000 | 1003 | ok |
| 3000 | array overlap + OR | 42.4 | 3000 | 16845 | scanned-budget |
| 3000 | junction branches | 7.0 | 3000 | 6749 | ok |
| 10000 | array overlap + OR | 42.1 | 10000 | 16845 | ok |
| 10000 | junction branches | 9.4 | 10000 | 11874 | ok |
