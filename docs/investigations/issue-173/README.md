# Issue 173 — supporting geodesic bay mouths

**Proceed to one bounded private certificate implementation.** The [design](design.md) removes
the radial-ray mouth restriction for a useful sufficient class while preserving all adopted
issue-167 targets. Every positive polygon stays on the chart-origin side of a supporting planar
mouth. Its shortest geodesic bows outward into empty water, so existing planar topology checks
and conservative Lambert bounds can certify the protected pocket without a general curved-edge
intersection engine.

The local example passes the bay opening, depth and removed-area thresholds, including the
largest retained body's bay-area floor. It is a bay witness, not a complete primary or world.
The [arithmetic corroboration](corroboration.json), [independent review](independent-review.md)
and [verification](verification.md) separate the analytic proof from binary64 diagnostic limits.

The next implementation must preserve the old radial path and all owner/collar/island checks,
test adversarial support and water intrusion cases, and receive independent review before a
separate coastline experiment. The exact curved area and witness-to-arc formula can be reported
as diagnostics; the first implementation's acceptance uses only conservative planar lower bounds.
This is a hypothesis for greater coast freedom, not a demonstrated cure for issue-172 R2/R3.

No production source, dependency, accepted v1/v2 data or old evidence changes. Human visual
selection remains pending. Commits remain local; no Git push is authorized.
