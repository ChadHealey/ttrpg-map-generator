# Issue 88 clean packaged preview gate

## Determination

**INVALID — no release determination.** The exact clean packaged candidate was built and the
attempted foreground observations are retained below, but they do not establish the contract's
fully painted first-paint boundary or a verified application process tree. They cannot pass, fail,
stop, or resume issue #84. No production code, schema, fixture, workload, hardware condition, or
numeric limit was changed here.

The threshold and sampled connectivity-proxy outcomes remain attributable only as deterministic
fixture evidence: the candidate is hash-matched to issue #87 and `corepack pnpm test:cross-platform`
passed with unchanged fixtures. Issue 87's retained outcomes are: proof
`-13854891` / 3 components / 50.276133%; fragmented `-13386485` / 7 / 54.385296%; control-max
`-13340379` / 1 / 100%. All three remain unsupported sampled proxies, as specified by the
version-1 contract.

## Candidate and environment

- Commit: `c14c478c44bc4092bec1d3d92200ecfc74074c1d` (contains issue-87 evidence commit).
- App: unsigned local arm64 bundle; executable SHA-256
  `333faea6f4403f94836de40b1cdf087c0202c7a42ddf6758bb11473eff5156d2`; 10,000,528 bytes.
- Toolchain: Node 24.11.0, pnpm 11.19.0, rustc 1.97.1, Apple clang 21.0.0, Xcode 26.4.
- Host: MacBook Pro `Mac17,2`, Apple M5, 24 GB, macOS 26.5.1 (25F80), AC attached,
  Low Power Mode off. The candidate uses packaged local assets; no debugger or network dependency.

The command outputs supporting these values are retained in
[`environment-receipt.txt`](environment-receipt.txt).

## Method and receipts

`run-preview-gate.zsh` is the retained attempted command. It keeps one System Events process
frontmost through control entry and receipt read, but it polls Accessibility while waiting for the
label. That label may be published before Canvas compositing, so it is not a fully painted
first-paint receipt. It also selects likely WebKit helpers by PID proximity rather than proving
parentage/roles. The sampler itself is the unchanged issue-76 C program, compiled with
`clang -O2 -Wall -Wextra`, at 5 ms requested cadence, but its aggregate and per-PID values are
therefore not release evidence.

The local raw CSVs and sampler logs from this invalid attempt contain machine-specific process
identifiers and timestamps, so they are intentionally not published in this public repository under
the privacy rule in `docs/05-git-workflow.md`. Their PID columns did not establish
app/GPU/Networking/WebContent role order. The attempted runs had 424–492 samples and maximum
observed intervals of 6.416–8.890 ms.

## Invalid attempted results

| Fixture            | Runs (ms)                                   | Median / worst    | Additional RSS (MiB)                        | Result              |
| ------------------ | ------------------------------------------- | ----------------- | ------------------------------------------- | ------------------- |
| proof              | 672.567, 766.737, 779.524, 742.181, 673.292 | 742.181 / 779.524 | 124.766, 133.688, 199.375, 119.016, 119.906 | invalid harness row |
| fragmented-islands | 724.148, 726.934, 708.515, 709.726, 800.217 | 724.148 / 800.217 | 317.688, 319.750, 317.125, 311.734, 316.734 | invalid harness row |
| control-max        | 762.130, 741.073, 720.383, 731.249, 734.138 | 734.138 / 762.130 | 319.297, 319.672, 320.922, 317.438, 318.906 | invalid harness row |

The untimed warm-ups are retained as `warmup-proof-17`, `fragmented-warmup`, and
`control-max-warmup`. Their Accessibility elapsed observations were 693.494, 786.602, and
759.399 ms respectively; they are invalid and are not gate rows.

## Invalid and indeterminate observations

`proof-2`, `proof-4`, `fragmented-1`, and `fragmented-4` are retained in the command transcript
as invalid process-identity observations: the launcher had not exposed exactly three helpers at
the initial identity read. They were not substituted silently; later numbered runs supply five
recorded fresh-process attempts, all invalid for the limitations described above. `control-max-3`
retains its CSV and sampler log but is indeterminate because
the automation session did not return its one-command receipt; it is not counted above.

No clean-candidate preview failure is established. Completing issue #88 requires an approved,
non-production measurement boundary that can prove a post-composite frame and the application
process tree without expanding into prohibited benchmark infrastructure. The issue must be
re-authored before another measurement attempt.
