# Issue 175 — proof and corroboration

The main task checked the positive-cone containment of the mapped geodesic, the inherited
outward-lens proof, the unbounded-ray argument excluding polygon interiors, and the finite
segment clipping recipe. A separate reviewer checked the same obligations and the more
permissive local example; its final record is [independent-review.md](independent-review.md).

Two distinctions are essential. A segment can cross the wedge while both endpoints lie outside,
so vertex-only checks are insufficient. Expanded clipping also cannot be used to require a
singleton shoulder contact, because valid edges meet that expansion near the endpoint. Exact
structural shoulder identities instead use an excluding active-face sign over the whole edge.
The derivative there is the linear `ell(v)=det(b-a,v)`, not the affine `L(v)`. The design records
a concrete entering edge that the mistaken affine expression would accept.

The [arithmetic script](corroborate.mjs) reproduces the [saved JSON](corroboration.json). It checks
simple B/E/pre-cut topology, witness containment, boundary clips at only structural shoulder
endpoints, the old certificate's rejection limited to global-support occurrences, conservative
bay dimensions, a crossing with both endpoints outside, actual lens intrusion, radial-face
contact and the positive derivatives of the unbounded ray. This is ordinary binary64 example
corroboration, not the successor's conservative acceptance implementation or a formal interval
certificate. No finite samples substitute for the proof.

The expanded B example has opening bounds about `[.208883,.275753]` radians, depth lower bound
`.200179`, ratio lower bound `.725938`, and planar removed area `.05935` steradians. These exceed
the adopted bay minima, including the largest retained primary's `.03262816`-steradian floor.
The whole primary's inventory, exact requested owner quota and visual acceptance are unproved.

```sh
node docs/investigations/issue-175/corroborate.mjs
corepack pnpm exec prettier --check docs/investigations/issue-175
corepack pnpm exec eslint docs/investigations/issue-175
```

Formatting, lint, relative links and public-content checks pass. Staged whitespace and the
repository precommit checks accompany the local commit. The production/native stages and the
original root timeout plus successful recovery remain recorded in
[issue-168 verification](../issue-168/verification.md) and are reused for unchanged production
sources. No clean single root run, formal outward arithmetic or cross-platform equality is
claimed. No accepted data, old evidence or production code changed, and no Git push was performed.

The next bounded implementation must turn every negative boundary in the design into tests,
preserve both prior modes and receive proof-to-code review before a new constructor experiment.
