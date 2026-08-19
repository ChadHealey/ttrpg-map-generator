# Issue 83 Apple M5 packaged preflight

- **Status:** PASS
- **Measured:** 2026-08-19 09:48:34 MDT
- **Candidate commit:** `3947f1ae29bba6da7188c600c89e012db5047f1f`
- **Packaged executable SHA-256:**
  `5a0de7f321a5585aaf95b54c8cf1a904c12792d93af7debab48e5e4dde2b30af`
- **Structured result:** [raw-results.json](raw-results.json)

The candidate commit was created from the unchanged source tree used for the packaged build after
all implementation gates passed; no source, configuration, fixture, or build input changed between
the build and commit. This is the one clean proof-fixture implementation preflight required by
issue 83, not issue 70's later warm-up plus five-fresh-process release protocol.

## Host and toolchain

The run used MacBook Pro `Mac17,2`, Apple M5, 24 GB unified memory, macOS 26.5.1 (`25F80`), AC power
connected, and Low Power Mode off. Toolchain versions were Node 24.11.0, pnpm 11.19.0, and rustc
1.97.1.

## Commands and accounting

The candidate and issue 76 sampler were built with:

```text
corepack pnpm --filter @ttrpg-map/desktop tauri build --bundles app
clang -O2 -Wall -Wextra -o /private/tmp/issue83_rss_timeline \
  docs/investigations/issue-76/rss-timeline.c
```

The sampler source SHA-256 was
`3de8e6fb7a2cb062d3f1d3ecdfe6dae1538c2cf7ade0d6d9d219edfcace594b6`; the compiled sampler SHA-256
was `52c6a9a72d60b7584d18a3fd6e4052ed360415472acb2da70c8ea12e45375d68`.

One shell lifetime launched the exact packaged executable, used named Accessibility controls to
complete the coarse preview, resolved the app/GPU/network/WebContent process group from their fresh
launch, started the sampler, pressed `Accept full atlas`, and waited for the exact accepted status
`Full-resolution atlas validated and accepted atomically.` The sampling command was:

```text
/private/tmp/issue83_rss_timeline 40 5 /private/tmp/issue83-full-qualifying.csv \
  82108 82110 82111 82112
```

The harness receipts were:

```text
preview started=1787154506898 ready=1787154510836 acceptEnabled=true
full started=1787154514808 completed=1787154524112 accepted=true
samples=6530 max_interval_ms=14.407
```

The sampler requested 5 ms observations and its observed maximum interval was 14.407 ms, below the
required 20 ms maximum. The maximum-sampled aggregate delta uses the last sample before the full
Accessibility start receipt as the settled preview baseline, matching issue 76 accounting. The
trace SHA-256 was `72b5f1ca64c8d2bb758ba2a441e73df2a681a579b5ddd9b6d77d49bd7c70a145`.

## Result

| Measure                              |          Result |
| ------------------------------------ | --------------: |
| Full accepted elapsed time           |        9,304 ms |
| Settled pre-operation baseline       |     328.641 MiB |
| Maximum aggregate RSS                |     773.375 MiB |
| Maximum additional aggregate RSS     | **444.734 MiB** |
| Issue 83 preflight limit             |         640 MiB |
| Headroom                             |     195.266 MiB |
| Accepted-presentation additional RSS |     444.281 MiB |

Per-process peaks during full acceptance were:

| Process           | Baseline RSS |    Peak RSS |
| ----------------- | -----------: | ----------: |
| App               |  104.250 MiB | 104.297 MiB |
| WebKit GPU        |   40.484 MiB |  49.422 MiB |
| WebKit networking |   14.859 MiB |  14.859 MiB |
| WebKit WebContent |  169.047 MiB | 604.828 MiB |

The maximum aggregate peak is sampled at one instant; it is not the sum of independently timed
per-process peaks. The result passes the 640 MiB issue 83 stop condition without changing the
768 MiB release limit or substituting for issue 70's complete release protocol.
