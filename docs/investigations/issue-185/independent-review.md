# Issue 185 independent review

The final private registry has no remaining actionable correctness, regression, security or
test finding. This review resolves the bounded seed-namespace design question only; it does
not accept a production generator, geometry family, persisted tuple or visual result.

## Contract and implementation

I independently inspected the typed registry, runtime adapter, matrix, evidence verifier and
tests against the released core seed-input, derivation, stream, identity and generated-aspect
contracts. The registry imports the declared public core entry point. The adapter checks the
package name and export before collecting its transitive source closure; it does not replace
the released random stream with a private generator.

The proposed ten-field `MapEntitySeedInput` retains derivation and stream versions 1, uses
generator version 3, and checks the actual map-derived world-surface singleton. Transient
owner/member ordinals appear only in finite descriptive concern names. Those names do not
allocate accepted entities or replace the parent macro aspect's persisted name or seed metadata.

I checked the draw inventory against the frozen 179/182 constructors and 170 placement:
three draws per base/large anatomy stream, four per detached member, three per guided
rotation, at most 256 center-direction draws, 64 refinement draws and one orientation draw
per reserved owner/attempt concern. The full reservation is 3,026 names and 170,226
`nextFloat64` calls. Unused candidates and attempts need not execute. Each such float call
uses one released raw stream advancement; the design correctly avoids claiming a fixed
raw budget for rejection-based `nextInt`.

The fixed matrix compares complete bounded vectors from fresh streams for shared scopes
across counts, category zeros and evaluation orders. Revision changes and the separate
classification sentinel are scoped seed observations. The documentation correctly distinguishes
them from geometric invariance, classifier-output invariance and permission to reorder
stateful placement. Changed concern names and float resolution require new production
output evidence; the historical private images cannot establish that evidence.

## Resolved finding and evidence boundary

Before the first capture I reproduced a malformed-key bypass: comparing comma-joined key
names admitted `{kind: 'island', candidate: 0, 'member,owner': 0}` and produced an undefined
owner/member namespace. The final implementation compares key-array lengths and individual
names. Its exact malformed-input regression passes. No retained capture was replaced to
repair this defect.

The final verifier binds the complete source inventory, source text and runtime/tool versions
to the trusted current closure before compilation. It executes only that trusted closure,
checks artifact hashes, reproduces canonical bytes and checks source stability afterward.
Coherently rehashed untrusted source and path mutations are rejected before replay. This is
a deliberately local, source-bound verifier, not a claim of portable historical execution.

## Independently executed checks

- Strict private TypeScript check passed.
- All six registry tests and all 65 unchanged core seed-input, derivation, stream, identity
  and generated-aspect tests passed.
- `node docs/investigations/issue-185/run.mjs --verify` passed: 48 rows, 6,052 vectors and
  76 captured source files, with exact artifact replay.
- Both saved-evidence tests passed: exact recorded replay, changed vector-byte rejection
  and rejection of a coherently rehashed matrix-row mutation against fixed replay.

The accepted ADR, generator-3 persistence and contour contracts, public-control behavior,
human visual selection, production corpus and cross-platform evidence remain separate work.
No production or historical source was edited for this review, and no world was rendered.
