# Issue 189 implementation checkpoint

The published D3 plan is implemented privately. The source is being reviewed; no constructor,
placement, scalar field or semantic matrix has run. The exact 30 rows are in `corpus.mjs`.
There are no production changes, new geometry recipes, preview samples or diagnostic images.

`runtime.mjs` resolves core and generation through their declared public package entries and
compiles only a trusted transitive TypeScript closure. `run.mjs` verifies the fixed issue184
comparison-r2 manifest/results and each imported frozen runtime source before dynamic imports.
An arbitrary self-consistent replacement snapshot does not authorize execution. The immutable
capture also includes the public package manifests, lockfile, runtime/tool versions, machine
corpus, policy, tests and private source. Both capture and current-source equality are required.

`bridge.ts` uses the actual public H contour constructor, quantizer, classifier and full-profile
reader. Sampling uses only the continuous frozen `evaluate` method and clamps finite F once;
the private million-tick `raw` method and a zero contour cast are not used. The explicit dense
land/water array is converted with public `createCompactLandWaterSampleReader`, rather than
constructing a fake accepted field or semantic record. Coverage is the actual public classifier's
rounded result. Full owner errors are diagnostics, not preview gates.

`pipeline.mjs` keeps validity, analytic exclusion, construction, placement, field and semantic
failures distinct. Every analytic exclusion precedes constructor entry. Calls are charged before
invocation, so exceptions consume their attempted-call budget. Only successful complete geometry
can share scalar work. The deduplication projection retains the entire construction and placement
receipts, deleting exactly three keys from `construction.recipe`: `physicalKmPerRadian`,
`fragmentationBand` and `oceanConnectivity`. The outer input is not part of that projection; it
remains in every row receipt. No owner, candidate, quota, certificate, coordinate, selected layout,
site ledger, seed scope, placement counter or frame field is deleted. Equality is checked on
serialized bytes as well as SHA-256 keys. Expected duplicate mismatches stop scalar execution
without expanding the 18-field budget. Empty failed constructors are never deduplicated successes.

`measure.mjs` preserves completed scalar/classification summaries when a later partition fails.
Each requested semantic mode is independently attempted on the exact same immutable full mask.
The public partition uses four-neighbor sphere connectivity; it is distinct from D1's marching
saddle graph. Original paid-component membership is diagnostic provenance, so sampled mergers
or missing anchors cannot be counted as successful intended fragmentation. Integer area sums and
BigInt cross-products decide polar ordering and the majority threshold. The secondary z-squared
moment and chart hull deficit are floating diagnostics, not interval proofs.

`metrics.mjs` checks the public ocean outcome predicate, not a stricter global-root interpretation
for connectedMajority: each open graph component has exactly one basin root, the largest region
is rooted correctly, and the largest connected component reaches 90%. A legal 90/10 graph with
two disconnected basin roots passes connectedMajority; an 89/11 graph fails. The unchanged public
segmenter may produce a narrower set of graphs. Its one allocated region leaves zero-versus-one
clearance cores ambiguous; no private core labels or exact count are invented.

Artifacts comprise one receipt for each of 30 inputs; a JSON summary and compact bit buffer per
attempted unique scalar field; a decision/mapping; the exact source closure and completion hashes.
Shared row receipts reference their field key and keep requested metadata and semantic outcomes.
Full scalar arrays are ephemeral, with explicit little-endian hashes. Public partition and
semantic membership ranges are retained for independent saved-data review. No semantic EntityIds
are manufactured. A partial field is marked explicitly; its bit buffer cannot be mistaken for a
completed accepted profile. There is one pass and one separately authorized computational replay,
with no in-pass repeat. Hashes-only verification invokes neither constructors nor scalar fields.

The original certificates and quotas remain authoritative for source geometry only. D1's
sample-survival and extracted-role proof gaps, the rejected visual family and the analytic
public-domain failure all remain open product gates. Final outcome documents follow the capture;
this pre-execution declaration must not be rewritten to fit results.

Pair reports retain raw polar and source hull measurements separately from eligibility. Positive
control diagnostics require all three source geometries, completed fields and passing total
coverage; semantic outcomes are recorded separately and also required for the complete control
diagnostic. Partial sampling/partition results and failed coverage cannot turn an otherwise
monotonic raw metric into a passing control case. Fragmentation before placement is labelled
source-only until the same prerequisites are satisfied.
