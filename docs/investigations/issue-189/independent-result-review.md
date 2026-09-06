# Independent retained D3 result review

**The retained experiment is reproducible evidence of control limitations, not a selected v3 implementation.** I found no remaining actionable correctness or provenance defect in the saved result. The full-profile coverage measurements pass, but both polar comparisons and both fragmentation comparisons fail their declared intent checks. Both requested multiple-basins outcomes are explicitly unsupported. Completion of a row's diagnostics must not be reported as completion of all its control intent.

## Evidence and independent verification

The frozen source manifest is `0e3219d6758a880a0dc3581490105465f9a4ba6e4066636e11520f9e8d625c3d`. I ran `node docs/investigations/issue-189/run.mjs --hashes-only`: exact current authority, 139 sources and all 30 rows passed. The capture contains 60 files, including 13 full-profile bitsets and their field reports. The author reports the one authorized computational replay passed with identical receipts and counts; I did not perform another replay.

Independently, using only retained bits, component/region ranges and source-defined arithmetic, I checked all 27,236,378 saved sample positions across the 13 fields. Every bitset hash and padding bit agrees. All 270 saved surface components have disjoint, exhaustive ranges of the correct land/water kind, exact sample counts and exact integer spherical area weights. Reconstructing their index arrays from those ranges reproduces every saved little-endian component-index hash. The 42 returned semantic regions across the 21 successful semantic rows similarly cover precisely water, have matching counts/weights and reproduce their saved region-index hashes. Their retained reciprocal links and component area/root ledgers agree. This checks reported allocations; it does not rerun or independently reproduce the clearance segmentation algorithm.

The source-defined integer weights also reproduce every north, south, combined-cap and global land numerator/denominator. Exact integer cross-products reproduce both paired comparison signs without relying on displayed rounded percentages. Weighted coverage reproduces the saved public rounding. All 13 complete fields pass the unchanged full-profile coverage gate; the maximum error is **0.2485 basis points**, or **0.002485 percentage points**. Normalized-value and tick hashes are supported by the source-bound computational replay, not recoverable from land bits alone. No preview, extracted contour, geometry certificate transfer or visual test was performed here.

One pass used 28 constructors, 24 placements, 328 template attempts, 13 unique fields, 27,236,378 scalar evaluations, 13 partitions and 23 semantic calls. The author's single replay repeats those counts. My review spent no constructor, scalar, partition or semantic calls.

## Observed controls and failures

| Seed                 | Neutral combined polar land | Ocean-biased combined polar land | Land-biased combined polar land | Necessary direction result                  |
| -------------------- | --------------------------: | -------------------------------: | ------------------------------: | ------------------------------------------- |
| `1`                  |                  32.447706% |                       34.614572% |                      19.830139% | Fails: both combined directions reverse     |
| `180000000000000001` |                  57.795895% |                       26.912543% |                      60.225109% | Fails: land bias decreases the southern cap |

These pairs have valid source geometry, completed fields, passed coverage and successful semantic outcomes. Their failures therefore reflect the measured global-cap intent, not an eligibility failure. For the second seed, the southern cap falls from 59.784528% land to 49.477655% under land bias, despite the combined-cap increase. Owner-local shape stretching is not a demonstrated planet-axis control.

For each seed, fragmentation 0, 35 and 100 retain exactly equal primary-body diagnostics and shared fields. The quota-weighted hull deficit remains 0.11707093891092546 for seed 1 and 0.12564968436986002 for the second seed. The declared strict increase is absent. This body-outline observation is distinct from detached island abundance and sampled component topology.

The three ocean modes share each seed's unchanged reader, but each requested semantic operation is separately attempted. Single-global and connected-majority outcomes pass. Both multiple-basins requests return the actual public policy's unsupported result. One allocated open region in these baseline masks leaves zero-versus-one clearance core unresolved; neither a fabricated exact core count nor a general semantic no-op follows from equal scalar fields. Other successful boundary fields expose multiple open regions under the same public policy, confirming why raw water connectivity alone cannot answer the semantic question.

Independent abundance controls retain their intended separation: island-zero keeps eight archipelago members, archipelago-zero keeps eight standalone islands, and both-zero has neither. Maximum abundances produce 16 standalone islands and 28 archipelago members. Circumference endpoints retain the baseline angular field while changing the physical scale metadata. These are narrow observed/source-supported behaviors, not whole-control-family acceptance.

All original paid components have at least one land anchor on the sampled fields. Nevertheless, the balanced-distribution field has one sampled merger and the maximum-abundance field has three. This corroborates the distinction between paid continuous components and sampled components; it supplies no missing D1 role-survival proof.

The 30 row dispositions are 21 diagnostics-completed, two semantic control-no-proposal, two analytically excluded, four construction-no-proposal and one placement-no-proposal. Count 1 at water 45 and 58 is excluded before construction by this family's chart-capacity bound. Count 1 at water 59/80, count 8 at water 80, and count 4 at water 45 exhaust declared construction candidates. Count 8 at water 45 exhausts placement. Exhaustion is a retained bounded-search result, not an impossibility theorem. Every input remains valid under the unchanged public parser.

## Contract interpretation and remaining work

The [adopted failure contract](../issue-167/README.md) permits a valid input to return no proposal for a demonstrated conflict or exhausted finite budget. The [production contract](../issue-181/production-contract.md) also permits explicit unsupported ocean outcomes. Therefore the frozen D3 policy's phrase “first required construction design” for a sole-owner q=.55 representation must be read as a requirement **if support for that excluded tuple is pursued**, not a newly adopted obligation that every valid tuple succeed. Its capacity observation is sound; broad-owner support expansion is optional. No validator clamp, public-domain restriction or automatic schema change is implied.

A useful default cohort, convincing visual family, honest supported-control behavior, D1 realization/feature evidence and production compatibility gates are still required. Conditional no-proposal does not excuse an all-inputs-fail policy or permit falsely claiming polar/fragmentation control on a successful output. The saved `selectedProposal:null` and `fullPublicDomainSupported:false` remain truthful scope indicators. This investigation neither selects v3 nor requires a broad-area representation before all other useful work can continue.
