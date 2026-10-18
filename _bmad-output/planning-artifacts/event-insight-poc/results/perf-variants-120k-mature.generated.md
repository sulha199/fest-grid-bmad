### bench120k mature (85% ended): 120012 events, 13394 with something still open (median of 5 EXPLAIN ANALYZE runs, execution time)

| variant | offset 0 | offset 200 | offset 2000 |
|---|--:|--:|--:|
| V0 current (JIT on, server default) | 311.0 ms | 288.6 ms | 315.1 ms |
| V1 current, JIT off | 239.2 ms | 233.6 ms | 255.1 ms |
| V2 current + `events.id` tie-break, JIT off | 247.0 ms | 236.9 ms | 233.6 ms |
| V3 one LATERAL aggregate for the key + id, JIT off | 230.7 ms | 254.7 ms | 232.8 ms |
| V4 maintained `events.bench_key` + (key,id) index, JIT off | 503.2 ms | 451.6 ms | 480.3 ms |
| V5 maintained key, index holds only events with something still open (grace 0), JIT off | 0.4 ms | 2.9 ms | 127.6 ms |
