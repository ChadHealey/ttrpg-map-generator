# Verification and provenance

The independent design and source reviews preceded the useful component executions. The main
task independently checked the complete prospective formatted manifest before authorizing the
single capture. Its SHA-256 is
`6b8ccf8f0fb6ea68181e8b4c2700adceb49a475e90c146cfe5374d781fa8f8ba`, matching the actual saved
manifest exactly. All 22 captured files were formatter-idempotent before execution.

The first useful geometry execution evaluated both complete fixed fixtures. Both pass, with
zero construction errors. Source text, hashes and the two fixed input IDs were written before
the first useful runtime import. The exact repeat and read-only replay reproduce both receipts
and both PNGs. No captured source, literal, review or evidence was changed after execution.

Executed checks:

```sh
node docs/investigations/issue-188/run.mjs --verify components
pnpm exec vitest run docs/investigations/issue-188/*.test.mjs
pnpm exec vitest run docs/investigations/issue-176 docs/investigations/issue-178 docs/investigations/issue-187 docs/investigations/issue-188
pnpm exec prettier --check docs/investigations/issue-188
pnpm exec eslint docs/investigations/issue-188
```

The [independent result review](independent-result-review.md) also ran all 17 focused tests.
The 17 focused tests pass; the combined investigation suite passes 73 tests in 10 files.
Before capture, 11 tests exercised only historical baselines, retained primary candidates and
malformed/combinatorial inputs. They cover exact legacy/default equality, ordered-ring reversal,
malformed modes, primary inventory and share preservation, each missing attachment, invalid
far cuts/disks, whole-body mismatch, pocket/lens intrusion and exact partition identities.

After capture, six additional tests re-certify the actual component receipts and show the old
B-only rejection. They verify source-bound replay, exclusive recording, invalid third capture,
coherently rehashed source injection, unknown paths, unexpected inventory, changed images and
coherently false summary counts. Every half-image pixel equals its declared native even-coordinate
sample. Both actual image sizes were visually inspected; see the disposition for the limited
component interpretation.

Two test-only expectations were corrected during verification: the historical 172 reader first
used the local-report `result` key rather than its `construction` key; and a direct deep equality
compared reflected JavaScript -0 with its JSON-serialized 0. The latter now compares the exact
JSON encoding defined by the receipt, while the runtime still checks exact repeated in-memory
results before serialization. Neither correction changed geometry, certificate code, capture
sources or evidence. The first combined run included that same -0 test failure; its corrected
rerun passed.

The source capture binds the static runtime closure, both independent reviews, the literal
design, harness plan, source loader, runner, package lock and Node/TypeScript/Prettier versions.
Replay checks trusted current source bytes before loading the matching in-memory closure;
self-reported hashes do not authorize retained code. This remains ordinary binary64 diagnostic
evidence, not formal interval or cross-platform certification. Repository-wide final checks,
Git actions and issue disposition remain the main task's boundary.
