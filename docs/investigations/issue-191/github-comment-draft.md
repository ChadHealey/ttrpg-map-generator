# Issue 191 — local review handoff draft

Not posted. No GitHub issue state was changed.

The private structured field experiment is implemented under `docs/investigations/issue-191/`.
State 2 retained all 18 native/half image pairs and the full 128-seed preview sweep, followed by
one exact repeat. Every sampled row passed placement, coverage, per-owner quota and gap checks;
the sweep's no-proposal rate was 0/128. The implementing assistant inspected all 36 images and
rejected all 18 rows at both sizes under the issue-164 visual contract. The recurring defects are
rounded bodies, geometric bites, weak internal hierarchy and mechanical margin dots.

The first state aborted on a harness error before any completed row or image was retained. Its
original claim, source snapshot, inputs and manifest remain unchanged. The second state repaired
the harness and used identical numeric parameters. No third state or parameter tuning occurred.
This leaves the first-state complete-evidence acceptance criterion unmet; this is a partial
investigation deliverable, not a completed or accepted issue.

Maintainer request: review `visual-review.md` and provide a verbatim PASS/FAIL decision for
normal-01, normal-02, normal-03, normal-04, connected-majority, fragmented-islands, and
default-001 through default-012. One explicit decision applying to all eighteen can be recorded
verbatim for each. Human decisions are pending; assistant judgment does not replace them.

Dedicated read-only review remains pending. Review the branch diff and current working-tree
additions against issue #191 and its acceptance criteria, reporting only actionable correctness,
regression, security, or test findings. No measurement child is justified by assistant rejection.
