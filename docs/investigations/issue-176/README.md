# Issue 176 — private water-wedge certificate

**Completed private predicate; no coastline family selected.** The implementation follows the
independently reviewed [issue-175 design](../issue-175/design.md) and preserves all adopted
issue-167 targets. The explicit `bay.mouthKind: 'wedge-geodesic'` mode excludes every positive
boundary segment from the radial water wedge, with exact structural shoulder handling. It can
allow surrounding land that the earlier global-support predicate rejected.

Existing radial and supporting-geodesic modes retain their complete results. Unknown modes and
failed wedge inputs reject without fallback. Planar pocket/pre-cut topology, water witnesses,
exact paid areas, general collars, islands, caps and all conservative bay measurements remain
required. The new code does not claim formal interval arithmetic or replace those obligations.

[Independent review](independent-review.md) found no actionable defect.
[Verification](verification.md) records 140 combined tests, exact replay of 54 stored radial
receipts, supporting-mode regression and an independent rational clipping check. These establish
the predicate boundary, not a complete primary, world, visual pass or production generator.

The next step is a separately bounded coast experiment with broad integrated role regions and
the newly reviewed bay freedom. It must first certify the complete retained cohort and packing
bounds before a world comparison, preserve failed evidence and obtain independent native/half
review. No production source, dependency, accepted v1/v2 data or earlier evidence changed.
Commits remain local; no Git push is authorized.
