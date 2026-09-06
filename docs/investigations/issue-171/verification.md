# Issue 171 — verification and design decision

**Design review complete; a separate local implementation is justified.** No shared certificate
code, production file, fixture, input or image was changed in this design-only issue.

The author and an independent mathematical reviewer examined issue 167's root/first-disk
obligations. The reviewer required the collar to be exactly the root-adjacent component after a
valid far crosscut, not an arbitrary included patch. The design explicitly requires ordered actual
coast prefixes, a nonempty distal component, exact identities, single attachment, whole disk
containment and separation of the entire far/distal side. A same-side curve that isolates only a
side-pocket disk cannot be used to invoke the opposing-chain bound.

Under those predicates the collar is a topological quadrilateral. A proper simple separator of
root from the far side connects the two opposing coast chains, so its spherical length is at least
`c*delta`. The actual mapped straight root supplies an upper bound `w/c`. The main task independently
reviewed this argument, its conservative metric use, finite polygon accounting and unchanged target
mapping. No remaining actionable mathematical finding was identified. These sufficient bounds may
reject adequate geometry and are not formal directed-rounding proofs.

The independent reviewer recomputed every synthetic table value using unchanged issue-169 polygon
helpers: opposing-chain distance .13, angular lower/upper widths .119737929220/.141141575690,
whole-disk bound .071967015522, collar area .03748125 and exterior area .05958125. It corroborated
simplicity of collar/feature/anchor/stitched union and the narrowing, extra-bridge and far-disk
negative examples. This is a bounded collar witness, not a complete primary, generated world or
human visual pass.

The source review also checked that moving sampled vertices in one fixed direction makes signed
shoelace area affine in the optional adjustment parameter; all final topology/area checks still
apply. Body fitting and paid island areas are separate exact contributions to one immutable owner
quota. Every island site is bounded and checked, and final cap/metric recertification prevents
unaccounted far islands from silently changing the geometric proof.

Focused formatting, relative links and staged whitespace checks run before the local commit.
The broader unchanged production check stages remain those recorded in
[issue-168 verification](../issue-168/verification.md): all stages completed across the root run and
its exact affected-test recovery. The original timeout/nonzero exit is disclosed there. This new
Markdown-only package does not justify repeating unchanged production/native tests; no code or
configuration changed in this issue. No Linux canonical equality is claimed.

The next issue must implement new, version-private collar predicates rather than silently switch
records into the old rectangle checker. Required local regressions include actual coast-prefix
identity, far-cut crossing, narrowing, alternate bridge, whole-disk exclusion, topology/area
partition and numerical ambiguity. Only a passing local implementation and certified candidate
cohort can justify a bounded comparison. All adopted visual and production gates remain in force.
