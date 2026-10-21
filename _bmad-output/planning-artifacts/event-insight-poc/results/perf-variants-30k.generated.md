### bench30k: 30012 events, 22337 with something still open (median of 5 EXPLAIN ANALYZE runs, execution time)

| variant | offset 0 | offset 200 | offset 2000 |
|---|--:|--:|--:|
| V0 current (JIT on, server default) | 882.2 ms | 960.8 ms | 893.9 ms |
| V1 current, JIT off | 175.1 ms | 181.6 ms | 214.4 ms |
| V2 current + `events.id` tie-break, JIT off | 202.9 ms | 173.2 ms | 224.4 ms |
| V3 one LATERAL aggregate for the key + id, JIT off | 195.1 ms | 168.2 ms | 185.4 ms |
| V4 maintained `events.bench_key` + (key,id) index, JIT off | 31.8 ms | 29.5 ms | 45.2 ms |
| V5 maintained key, index holds only events with something still open (grace 0), JIT off | 0.4 ms | 2.4 ms | 20.0 ms |
