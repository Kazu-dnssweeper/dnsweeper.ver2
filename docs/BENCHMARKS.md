# Benchmarks (M7)

This document describes how to run benchmarks and collect metrics.

## Presets
- Low latency: `examples/presets/low-latency.json` (qps=200, concurrency=40, timeout=3000, qpsBurst=20)
- High latency: `examples/presets/high-latency.json` (qps=50, concurrency=40, timeout=8000, qpsBurst=10)
- Strict rules: `examples/presets/strict-rules.json` (stronger weights)

## Runner
Use the bench runner to generate CSV, run analyze, and print `[bench]` with elapsed/rps.

```
# size=10k, low latency, with HTTP+DoH (requires network)
npm run bench -- --size 10000 --preset examples/presets/low-latency.json --http --doh 2> .tmp/bench-low.log

# high latency
npm run bench -- --size 10000 --preset examples/presets/high-latency.json --http --doh 2> .tmp/bench-high.log

# strict rules
npm run bench -- --size 10000 --preset examples/presets/strict-rules.json --http --doh 2> .tmp/bench-strict.log
```

Notes
- Run each scenario 3 times and take the median of `[bench]` rps/elapsed.
- Use size=100 → 10k → 100k progressively. 100k should be run only on a suitable machine/network.
- Collect stderr summaries: `[summary]`, `[dns]`, `[http]`, and `[bench]`.

## Target (NFR)
- 100k rows under 15 minutes (concurrency=40, normal network)
- false positive < 1% (use strict rules preset and adjust weights accordingly)

## Report Template
```
Scenario: low-latency (HTTP+DoH)
Runs: 3
Size: 10k
Elapsed (ms): [r1, r2, r3]  Median: X
RPS: [r1, r2, r3]            Median: Y
HTTP errors: timeout:A tls:B 4xx:C 5xx:D ok:E
DNS: hits:H misses:M hit_rate:Z%

Observations:
- Bottlenecks:
- Tweaks:
```
