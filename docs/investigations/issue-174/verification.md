# Issue 174 — verification and completed scope

The new private opt-in supporting-mouth predicate is complete. Its
[independent proof-to-code review](independent-review.md) reports no actionable finding.
The main task also inspected the helper and the complete diff against the frozen issue-172
certificate; the radial calculation remains unchanged, and supporting failures cannot fall back.

Eleven focused tests cover the useful standalone bay, complete ring/mouth reversal and input
immutability, incorrect order and near-matching identities, unknown kinds, near-radial support,
extra contacts, positive mouth edges, wrong-side roles and islands, outward-lens intrusion,
retained planar pocket intrusion, invalid witnesses/caps, conservative threshold failures and
bounded malformed input. The largest retained primary's `.02Q` removed-area floor is exercised
explicitly through the standalone bay helper; a full primary without its lobes and peninsula
still fails the complete owner certificate. No missing anatomy is waived.

The combined issue-169/170/172/174 suite passes **118 tests in 20 files**. Both retained radial
six-input constructors produce exactly the previous whole certificate outputs, including an
explicit `radial` kind. Independently, the reviewer read all **54 saved radial owner receipts**
directly from the two frozen comparison files and obtained exact equality from the new private
certificate. This avoids relying solely on freshly regenerated expected outputs.

The reviewer also evaluated twelve rotations of the supporting example; every orientation
passes and retains the expected depth lower bound within `1e-12`. This confirms that the
nonradial path is not hardcoded to the example's vertical mouth. No scalar grids, atlas PNGs,
new constructor matrix or cross-platform equality were generated or claimed by this issue.

```sh
corepack pnpm exec vitest run docs/investigations/issue-169 docs/investigations/issue-170 docs/investigations/issue-172 docs/investigations/issue-174
corepack pnpm exec prettier --check docs/investigations/issue-174
corepack pnpm exec eslint docs/investigations/issue-174
```

Formatting, lint, relative links and public-content checks pass. Staged whitespace and the
repository precommit checks accompany the local commit. The original broader check timeout and
successful recovery are retained in [issue-168 verification](../issue-168/verification.md);
production/native stages remain unchanged and are reused. This is not a clean single root-run
claim. No production source, dependency, accepted data or older evidence changed, and no Git
push was performed.

The certificate retains the documented analytic-proof versus binary64 EPS/slack distinction.
It establishes a useful sufficient bay class, not formal outward arithmetic, complete primary
construction, visual acceptance or production readiness. A separate design may investigate
less restrictive water-wedge exclusion before another constructor experiment.
