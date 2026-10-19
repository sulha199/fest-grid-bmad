### bench300k (month-12 shape): 300012 events, 22196 with something still open (median of 5 EXPLAIN ANALYZE runs, execution time)

| variant | offset 0 | offset 200 | offset 2000 |
|---|--:|--:|--:|
| V0 current (JIT on, server default) | 1114.6 ms | 1123.9 ms | 1019.1 ms |
| V1 current, JIT off | 503.0 ms | 483.7 ms | 534.9 ms |
| V2 current + `events.id` tie-break, JIT off | 485.5 ms | 542.7 ms | 486.2 ms |
| V3 one LATERAL aggregate for the key + id, JIT off | 460.2 ms | 521.7 ms | 606.5 ms |
| V4 maintained `events.bench_key` + (key,id) index, JIT off | 1926.1 ms | 1866.3 ms | 1892.4 ms |
| V5 maintained key, index holds only events with something still open (grace 0), JIT off | 0.5 ms | 4.0 ms | 277.3 ms |
