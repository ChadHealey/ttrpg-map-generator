# ADR-0008 — `.mapworld` directory commit and crash recovery

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** Project maintainer
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 1 must save and reopen the canonical directory package from
[ADR-0007](0007-canonical-mapworld-v1.md) without losing either the previously accepted package
or a fully prepared replacement after an interruption. [Issue #51](https://github.com/ChadHealey/ttrpg-map-generator/issues/51)
settles the protocol before issue #46 implements it across `@ttrpg-map/persistence`, the desktop
TypeScript adapter, and the Tauri/Rust native boundary.

A `.mapworld` target is a non-empty directory. POSIX, Linux, and macOS require a directory named by
the destination of `rename` to be absent or empty; they do not provide one portable operation that
replaces an existing non-empty directory. POSIX also distinguishes atomic namespace mutation from
durability: an application that needs a directory change to survive a crash must synchronize the
directory. The relevant platform contracts are the
[POSIX `rename` specification](https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html),
[POSIX directory-synchronization rationale](https://pubs.opengroup.org/onlinepubs/9799919799/xrat/V4_xbd_chap01.html),
[Linux `rename(2)`](https://man7.org/linux/man-pages/man2/rename.2.html),
[Linux `fsync(2)`](https://man7.org/linux/man-pages/man2/fsync.2.html),
[macOS `rename(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/rename.2.html),
[macOS `fsync(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fsync.2.html),
and [macOS `F_FULLFSYNC`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fcntl.2.html).

The protocol must preserve accepted semantic data, constraints, locks, decoration, and user edits.
Recovery cannot use modification time, directory iteration order, a random suffix, or a display
name as package identity or selection priority. It must validate exact package bytes through the
released `.mapworld` contract and stop conservatively when filesystem state does not prove one
choice safe.

This ADR keeps the transitions, recovery decisions, and interruption matrix together because they
are one executable protocol. The implementation may split pure helpers for reviewability, but the
public decision entry point and this state table remain the only policy surface and protocol source.

## Decision drivers

- Never discard the only package that passes the canonical byte, checksum, schema, reference, and
  domain validation owned by issue #8.
- Keep the old valid package discoverable until the new package's directory entry is durable.
- Use only same-parent, no-replace atomic renames; never claim portable atomic replacement of a
  non-empty directory.
- Make every recovery choice reproducible from versioned bytes and fixed role order, without clocks,
  randomness, locale, or ambient directory ordering.
- Keep schema and recovery decisions in TypeScript while confining OS-specific synchronization and
  rename behavior to a narrow Rust adapter.
- Return stable, actionable errors and preserve unrecognized or conflicting artifacts for explicit
  user resolution.

## Options considered

### Rename a temporary directory over the target

This is the familiar regular-file protocol, but it is not the contract for non-empty directories.
POSIX, Linux, and macOS reject a non-empty destination directory. Deleting the target first would
also create an interval with no old package and no rollback name.

### Platform-specific atomic directory exchange

Linux `renameat2(RENAME_EXCHANGE)` and macOS `renameatx_np(RENAME_SWAP)` can exchange directories on
supporting filesystems. They are not a shared POSIX capability, support varies by filesystem, and an
exchange still needs durable directory entries, old-package cleanup, and recovery from failures
around those steps. A core safety promise must not depend on optional exchange support.

### Copy files into the target in place

An interrupted copy can combine old and new authoritative files. Checksums would detect the damage
but could not recover the only accepted package. Per-file rename does not make the package update a
single transaction.

### Versioned package directories plus an indirection file

Keeping immutable generations and atomically replacing a small pointer can work, but changes the
user-visible package layout, introduces retention policy and pointer recovery, and makes the selected
`.mapworld` path no longer be the package described by ADR-0007. The current scale does not justify
that additional storage model.

### Random or timestamped transaction names

Unique names permit concurrent staging but force recovery to scan, order, and identify an unbounded
set of leftovers. Time and randomness would become persisted recovery identity. Fixed names plus an
exclusive cooperating-writer lock give one bounded state machine and deterministic enumeration.

## Decision

### Names, roles, and ownership

For a user-selected target `P/N`, `N` must be a valid Unicode basename ending in `.mapworld`. It
must contain no separator or NUL and must not be `.` or `..`. The protocol derives exactly these
siblings; `v1` is the recovery-protocol version, not the package-schema version:

| Role      | Symbol | Kind              | Exact path                 |
| --------- | ------ | ----------------- | -------------------------- |
| Target    | `T`    | package directory | `P/N`                      |
| Temporary | `W`    | package directory | `P/.N.commit-v1.temporary` |
| Backup    | `B`    | package directory | `P/.N.commit-v1.backup`    |
| Marker    | `J`    | regular file      | `P/.N.commit-v1.json`      |

All mutations are descriptor-relative to one open `P`; no operation follows a symbolic link in any
role. A symlink, special file, wrong artifact kind, name collision, or derived name longer than the
filesystem permits is a conflict, not a candidate. `W`, `B`, and `J` are native recovery artifacts,
not contents of `T`; they are excluded from the v1 package and its authoritative checksum set.

The native operation takes a non-blocking exclusive advisory lock on the open parent-directory file
descriptor before enumeration and holds it through the final durability barrier. This serializes
cooperating app processes for every target in that parent. Failure returns
`persistence.recovery.operation-in-progress`. The lock is not persisted identity, and non-cooperating
filesystem mutation observed at a validation checkpoint is detected by no-replace operations,
artifact-kind checks, and exact fingerprint validation.

A valid `J` associates the transaction only with the exact `W` and `B` named inside it, and only
while every name equals the value derived from `targetName`. It proves intended roles and expected
`Vo`/`Vn` fingerprints; it does not prove the provenance or disposability of arbitrary bytes later
found at those paths. Automatic deletion authority therefore extends only to a currently validated
expected fingerprint or a truly empty directory. An absent, malformed, incompatible, or
name-mismatched marker grants no deletion authority. A clean state has neither `W`, `B`, nor `J`.

### Package fingerprint and marker bytes

A package fingerprint is lowercase SHA-256 of its exact canonical `manifest.json` bytes. The
fingerprint is usable only after the complete candidate passes `decodeMapworld`; the manifest's
authoritative-file hashes therefore bind it to every authoritative byte. It is not a replacement for
the manifest checksums and does not add a whole-package checksum to `.mapworld` v1.

`J` is strict canonical JSON using the same UTF-8, key order, indentation, LF, final-newline, and
safe-value rules as `.mapworld` v1. Its exact version-1 fields are:

```json
{
  "backupName": ".MyWorld.mapworld.commit-v1.backup",
  "candidateManifestSha256": "<64 lowercase hexadecimal characters>",
  "checksumAlgorithm": "sha256",
  "operation": "replacement-save",
  "previousManifestSha256": "<64 lowercase hexadecimal characters>",
  "protocol": "mapworld-directory-commit",
  "protocolVersion": 1,
  "targetName": "MyWorld.mapworld",
  "temporaryName": ".MyWorld.mapworld.commit-v1.temporary"
}
```

`operation` is exactly `first-save` or `replacement-save`. `previousManifestSha256` is `null` for a
first save and is required for a replacement. The marker has no phase, time, process ID, transaction
ID, display name, or random value. Its immutable intent plus the roles' validated fingerprints
determines phase after interruption. Updating marker phases would create a second atomic-replacement
problem without improving recovery.

Changing artifact names, marker fields or encoding, fingerprint meaning, transitions, or automatic
selection rules requires a new recovery protocol version. A reader must implement an old version or
report it as incompatible; it must never guess and delete its artifacts.

### Preconditions and durable primitives

Before creating `J`, both save kinds:

1. acquire the parent lock and inspect the four exact roles in `T`, `W`, `B`, `J` order;
2. reject a pre-existing recovery artifact and run reopen/recovery first;
3. validate the immutable candidate with `encodeMapworld` and `decodeMapworld`, then calculate its
   fingerprint;
4. probe that the parent directory can be opened and `fsync`ed; and
5. verify every derived name and required no-replace rename operation can be represented by the
   platform adapter.

A first save additionally requires `T` to be absent. A replacement requires `T` to pass issue #8
validation, its fingerprint to equal the adapter's expected last-opened fingerprint, and explicit
overwrite authority if the target was selected by Save As. A mismatch returns
`persistence.recovery.target-changed` before any artifact is created.

The implementation uses these primitives:

- **Durable regular file:** create with exclusive/no-follow semantics, write all bytes while handling
  partial writes and `EINTR`, call `fsync`, and close only after success. On macOS, also call
  `F_FULLFSYNC`; plain `fsync` may leave a volatile drive cache. This applies to every authoritative
  file and `J`.
- **Verified temporary package:** reopen every file without following links, compare its path,
  length, and exact bytes with the validated save plan, recalculate the manifest fingerprint, and
  reject missing, extra, or changed entries. Sync every containing directory bottom-up (`maps/`, any
  future authoritative subdirectory, then `W`) after its children are durable. The pre-save
  TypeScript validation plus native exact-byte readback is equivalent to rerunning the issue #8
  contract on the on-disk candidate without reimplementing that schema in Rust.
- **Durable recovery promotion:** before recovery renames a byte-valid `W` or `B` into `T`, repeat
  every authoritative-file `fsync`/full flush and containing-directory sync bottom-up. A candidate
  discovered after interruption may validate byte-for-byte even though the interrupted writer did
  not complete its original durability barrier; recovery never treats byte validity alone as proof
  that those bytes are durable.
- **Durable directory entry:** call `fsync` on the directory containing a create, unlink, `mkdir`,
  `rmdir`, or rename. Both package renames use the same open parent `P`, so one parent sync covers
  both source and destination entries. Linux explicitly requires this in addition to file `fsync`.
- **macOS ordering barrier:** after each directory `fsync`, call `F_FULLFSYNC` on an already synced
  regular file on the same device: `J` before `W` is complete, then the open candidate
  `manifest.json`, including after it moves to `T`. Current macOS documents this as a barrier for
  prior `fsync` operations on the device. Failure is not downgraded to success.
- **Durable recursive cleanup:** immediately before removing `B`, validate it again as the marker's
  exact `Vo`. Unlink its files without following links, `fsync` each containing backup directory
  after its entries change, remove child directories bottom-up, then remove `B` and sync `P`. Keep
  the open target `manifest.json` as the macOS barrier anchor. If interruption or failure leaves a
  non-empty backup that no longer validates as `Vo`, stop automatic cleanup, preserve it and `J`,
  and require candidate-specific confirmation before continuing.
- **Atomic no-replace rename:** use descriptor-relative macOS
  `RENAME_EXCL | RENAME_NOFOLLOW_ANY` and Linux `RENAME_NOREPLACE` behavior. Linux receives only
  final-component basenames relative to the already opened parent and `renameat2` renames, rather
  than follows, a final symlink. Source and destination are same-parent directories, and destination
  must be absent. Unsupported filesystem behavior returns
  `persistence.recovery.durability-unsupported`; it never falls back to copying or replacement.

Directory `fsync`, no-replace rename, advisory-lock, and full-flush behavior can vary on network,
removable, FUSE, or unusual local filesystems. The v1 implementation supports a volume only when all
required calls succeed. A failure before a rename leaves the current target unchanged. A sync or
barrier failure after a rename returns `persistence.recovery.durability-failed`, keeps `J`, and
requires the normal recovery path because the durable phase is uncertain. No success is reported
until the commit barrier completes.

### Bounded native byte transport

The desktop/native command boundary frames already validated package and marker bytes as canonical
base64 strings in both save requests and recovery snapshots. TypeScript and Rust reject malformed,
noncanonical, or over-limit encodings before policy or filesystem mutation. Rust decodes save
payloads before the unchanged exact-byte readback checks; TypeScript decodes snapshot payloads
before the unchanged `.mapworld` validation and recovery decision. This framing prevents large
Milestone 2 packages from becoming impractically large JavaScript arrays of boxed byte numbers.

The transport permits 128 MiB for one file and 192 MiB for one package. These bounded adapter
limits and base64 framing do not alter package bytes, marker bytes, artifact names, fingerprint
meaning, recovery transitions, or the v1 package/marker schemas. Changing those semantic protocol
elements still requires the version change described above.

### Isolated native FFI safety boundary

Rust's safe standard library does not expose every descriptor-relative and platform-specific
primitive required above. The implementation therefore confines all foreign declarations and
`unsafe` blocks to
`apps/desktop/src-tauri/src/mapworld_native/platform_ffi.rs`, with separate macOS and Linux
`cfg` arms. No higher module may call a raw symbol or manipulate a raw pointer.

The safe wrappers maintain these invariants:

- every basename is converted to an owned, NUL-free `CString` that remains alive for the complete
  native call;
- every passed file descriptor is valid for the call duration, and a newly returned descriptor is
  checked before it is immediately wrapped as an owned `File`;
- `fdopendir` receives ownership exactly once, directory-entry names are copied within the reported
  record/name bounds before the next `readdir`, and no pointer from the directory stream escapes;
- byte buffers remain allocated and correctly sized for the complete call; and
- failure return values are checked and `errno` is captured immediately, before another operation
  can overwrite it.

Focused native tests exercise every safe wrapper through real syscalls, fault injection, wrong-kind
and symlink inputs, lock contention, partial writes, `EINTR`, and the P00–P17 recovery matrix. The
unsafe boundary adds no domain interpretation and no fallback that copies over or deletes a target.

### First-save transitions

`Vn` means a package valid under issue #8 with fingerprint `n`; `Ø` means absent. `I` means present
but incomplete or invalid and is never selected as a package. Each sync below includes the macOS
barrier where required.

| State | Completed transition                                         | `T`  | `W`  | `B` | `J`     | Valid package discoverable after interruption                   |
| ----- | ------------------------------------------------------------ | ---- | ---- | --- | ------- | --------------------------------------------------------------- |
| F0    | Preconditions passed                                         | `Ø`  | `Ø`  | `Ø` | `Ø`     | None existed before this first save                             |
| F1    | Create/write/sync `J`; sync `P`                              | `Ø`  | `Ø`  | `Ø` | valid   | None; marker records intended candidate                         |
| F2    | Build, file-sync, verify, dir-sync `W`; sync `P`             | `Ø`  | `Vn` | `Ø` | valid   | New package at `W`                                              |
| F3    | Atomically rename absent `W -> T`; parent sync not completed | `Vn` | `Ø`  | `Ø` | valid   | Runtime: `T`; after crash: the F2 or F4 namespace               |
| F4    | Sync `P`; full barrier completes                             | `Vn` | `Ø`  | `Ø` | valid   | New package at durable `T`; this is the first-save commit point |
| F5    | Unlink `J`; final parent sync/barrier may be incomplete      | `Vn` | `Ø`  | `Ø` | `Ø`/old | New package at `T`; recovery may finish marker cleanup          |
| F6    | Final sync/barrier completes                                 | `Vn` | `Ø`  | `Ø` | `Ø`     | New package at clean `T`                                        |

Interruption during marker or package construction may leave `J` or `W` as `I`. Before F2 no valid
package has yet been created, so recovery preserves those bytes and reports that no valid package is
available. At and after F2, the only valid package remains under `W` or `T`; recovery promotes it
without overwriting another valid target.

### Replacement-save transitions

`Vo` is the verified previous fingerprint and `Vn` is the verified candidate. The two renames are
individually atomic; the pair is deliberately not described as one atomic directory replacement.

| State | Completed transition                                         | `T`  | `W`  | `B`          | `J`     | Valid package discoverable after interruption             |
| ----- | ------------------------------------------------------------ | ---- | ---- | ------------ | ------- | --------------------------------------------------------- |
| R0    | Preconditions passed                                         | `Vo` | `Ø`  | `Ø`          | `Ø`     | Old package at `T`                                        |
| R1    | Create/write/sync `J`; sync `P`                              | `Vo` | `Ø`  | `Ø`          | valid   | Old package at `T`                                        |
| R2    | Build, file-sync, verify, dir-sync `W`; sync `P`             | `Vo` | `Vn` | `Ø`          | valid   | Old at `T`; new at `W`                                    |
| R3    | Atomically rename absent `T -> B`; parent sync not completed | `Ø`  | `Vn` | `Vo`         | valid   | Runtime: old `B`, new `W`; after crash: R2 or R4          |
| R4    | Sync `P`; full barrier completes                             | `Ø`  | `Vn` | `Vo`         | valid   | Durable old at `B`; durable new at `W`                    |
| R5    | Atomically rename absent `W -> T`; parent sync not completed | `Vn` | `Ø`  | `Vo`         | valid   | Runtime: new `T`, old `B`; after crash: R4 or R6          |
| R6    | Sync `P`; full barrier completes                             | `Vn` | `Ø`  | `Vo`         | valid   | New at durable `T`, old at `B`; replacement commit point  |
| R7    | Remove revalidated `Vo` at `B`; cleanup may be interrupted   | `Vn` | `Ø`  | `Vo`/`C`/`Ø` | valid   | New at `T`; partial non-empty `B` is an attention state   |
| R8    | Sync `P`; full barrier completes after removing `B`          | `Vn` | `Ø`  | `Ø`          | valid   | New at `T`; marker still proves the completed transaction |
| R9    | Unlink `J`; final parent sync/barrier may be incomplete      | `Vn` | `Ø`  | `Ø`          | `Ø`/old | New at `T`; marker may reappear after crash               |
| R10   | Final sync/barrier completes                                 | `Vn` | `Ø`  | `Ø`          | `Ø`     | New package at clean `T`                                  |

The replacement is committed only at R6. Before R6 the valid old package is at `T` or `B`; from R2
the valid candidate is at `W` or `T`. Recovery normally resumes a marker-authorized replacement, but
the old name remains available until the new target entry is durable. Backup deletion begins only
after the R6 commit barrier and an immediate revalidation of `B` as exact `Vo`. A partial non-empty
backup left by interrupted cleanup remains discoverable with `J`; it is not automatically resumed.

### Reopen enumeration and validation

Opening `P/N` always runs recovery discovery before exposing a world document:

1. lock `P`, derive the four exact names, and raw-observe only `T`, `W`, `B`, and `J` in fixed
   role order; enumerate `P` once through the same descriptor with a 4,096-entry bound and require
   every non-absent role lookup to have an exactly byte-equal dirent basename; a case- or
   normalization-alias lookup whose exact bytes are absent is an unreadable
   `verify-exact-artifact-name` conflict and is never removable by the protocol;
2. reject symlinks and wrong kinds without following or mutating them;
3. parse `J` as strict canonical recovery JSON and verify its version, operation, names, and nullable
   previous fingerprint;
4. read each directory role without following links, sort normalized relative paths by code point,
   and submit its complete in-memory package to `decodeMapworld`;
5. classify each role as absent, invalid with the existing issue #8 diagnostics, or valid with its
   manifest fingerprint; and
6. pass only this immutable snapshot to the pure recovery state machine.

Directory modification time, marker modification time, display name, world-document ID, directory
iteration order, and “newest” are not selection inputs. Fixed role precedence is `T`, then `W`, then
`B`; it breaks ties only when fingerprints are identical. Different valid fingerprints are distinct
candidates even if a higher layer believes they describe similar user work.

### Valid recovery combinations and actions

The following combinations are the complete recognized stable states. A valid marker must match
every shown fingerprint and derived name. `E` is a directory proven to contain no entries. `C` is a
non-empty invalid or unreadable directory, wrong artifact kind, or valid package whose fingerprint
does not match the marker's expected value. `C` is always preserved as an attention state. In the
`any` row, at least one of `W` or `B` is `C`; that row takes precedence over cleanup rows.
Report `persistence.recovery.artifact-conflict` for `C`; any proposed destructive resolution also
returns `persistence.recovery.confirmation-required` until the user authorizes that exact candidate.

| Marker/operation | `T`      | `W`          | `B`          | Deterministic action                                                        |
| ---------------- | -------- | ------------ | ------------ | --------------------------------------------------------------------------- |
| none             | `Ø`/`Vx` | `Ø`          | `Ø`          | Nothing to recover; open `T` if valid                                       |
| first            | `Ø`      | `Vn`         | `Ø`          | Resume F2: rename `W -> T`, sync, clean `J`                                 |
| first            | `Vn`     | `Ø`/same/`E` | `Ø`          | Repeat commit barrier; remove exact duplicate or empty `W`, then `J`        |
| first            | `Vn`     | `C`          | `Ø`          | Open `T` read-only; preserve `W` and `J`; return attention                  |
| first            | `Ø`      | `Ø`/`E`      | `Ø`          | No valid package; remove empty scaffolding and `J`; report no valid package |
| first            | `Ø`      | `C`          | `Ø`          | Preserve `W` and `J`; report no valid package plus artifact attention       |
| replacement      | `Vo`     | `Vn`         | `Ø`          | Resume R2: `T -> B`, sync, `W -> T`, sync, cleanup                          |
| replacement      | `Ø`      | `Vn`         | `Vo`         | Resume R4: `W -> T`, sync, cleanup                                          |
| replacement      | `Vn`     | `Ø`/same/`E` | `Ø`/`Vo`/`E` | Repeat barrier; remove exact fingerprints/empty scaffolding, then `J`       |
| replacement      | `Vn`     | any          | any          | If either role is `C`, open `T` read-only; preserve artifacts and `J`       |
| replacement      | `Vo`     | `Ø`/`E`      | `Ø`          | Abort to old `T`; remove empty scaffolding, then `J`                        |
| replacement      | `Vo`     | `C`          | `Ø`          | Open old `T` read-only; preserve `W` and `J`; return artifact attention     |
| replacement      | `Ø`      | `Ø`/`E`      | `Vo`         | Roll back `B -> T`, sync; remove empty scaffolding, then `J`                |
| replacement      | `Ø`      | `C`          | `Vo`         | Roll back `B -> T`, sync; preserve `W` and `J`; return artifact attention   |

“same” is a byte-identical `Vn` duplicate. It can arise only from test injection or external copying,
not from either atomic rename, but deleting it is safe because a validated `Vn` already exists at
`T`. Deleting exact `Vo` at `B` is safe only after the durable `Vn` commit and immediate `Vo`
revalidation. Pathname association alone never makes `C` disposable.

An observed `Vn` at `T` may be the runtime side of F3 or R5 whose original parent barrier did not
return. Recovery therefore repeats the commit parent `fsync` and macOS barrier, validates `T` again,
and only then calls the state committed or begins cleanup. Repeating a successful barrier is
idempotent.

Every other marker-present combination is a conflict. In particular, a fingerprint not named by the
marker, non-empty bytes that fail validation, an unreadable or wrong-kind role, old and new appearing
simultaneously in impossible roles, a backup on a first save, or more than one different candidate at
a role stops automatic mutation of recovery artifacts. A valid `T` may still be opened read-only.
`J` remains until every conflict is explicitly resolved.

A readable, bounded directory tree that fails package validation is represented with its complete
sorted paths and bytes so a confirmation token identifies that exact candidate. An entry that cannot
be enumerated without following a symlink, opening a special node, or exceeding a bound stays
unreadable or wrong-kind and is never mutated. Confirmation remains necessary, but deletion is not
enabled until the role can be re-enumerated as the exact readable candidate; symlinks and special
files must always be resolved outside the application.

An attention result supplies the target and artifact role, expected fingerprint, actual fingerprint
when validation succeeds, issue #8 diagnostics when it fails, observed kind or read error, and the
candidate-specific actions that require confirmation.

With no valid marker:

- a valid `T` is selected only when no other role has a different valid fingerprint; other artifacts
  remain visible and block another save until confirmed cleanup;
- when `T` is absent and exactly one distinct valid fingerprint exists, promote the first valid role
  in `W`, `B` order with a no-replace rename and sync `P`; do not delete other unowned artifacts;
- when `T` exists but is invalid, never overwrite or remove it automatically, even if `W` or `B` is
  valid;
- any non-empty invalid, unreadable, wrong-kind, or unrecognized-fingerprint `W` or `B` remains an
  attention state and is never cleaned automatically;
- two or more different valid fingerprints return `persistence.recovery.ambiguous-candidates`; and
- no valid package returns `persistence.recovery.no-valid-package` with every candidate's issue #8
  diagnostics.

Selection and physical repair are separate results. The adapter may open a uniquely selected valid
target read-only while invalid or unowned artifacts await attention, but it must not report a clean
recovery or permit another save to that target.

### Automatic cleanup and confirmation boundary

Automatic cleanup is limited to state proved by a valid, matching `J`:

- remove `B` only when `T` validates as the marker's durable `Vn` and `B` immediately revalidates as
  the marker's exact `Vo`;
- remove `W` only when it validates as an exact `Vn` duplicate of durable `T`;
- remove a truly empty `W` or `B` directory when another selected package remains valid, or when
  aborting a first save that never produced a valid package;
- stop and preserve a non-empty partial `B` left by interrupted cleanup; explicit confirmation is
  required to finish removing it even though committed `Vn` remains safely openable; and
- remove `J` last, only after `W` and `B` are absent or explicitly resolved, then sync/barrier `P`.

The application requires an explicit, candidate-specific confirmation before it:

- chooses between different valid fingerprints;
- replaces or deletes any valid package not authorized by a matching marker;
- discards a non-empty invalid, unreadable, wrong-kind, wrong-fingerprint, or unexpected artifact;
- ignores, upgrades, or removes a malformed or unknown-version marker;
- overwrites an invalid object occupying `T`; or
- proceeds after names or fingerprints disagree with `J`.

Confirmation identifies roles and fingerprints, never “newest.” The default action is to preserve
all artifacts and offer open read-only, Save As to a different target, reveal in the filesystem, or
cancel. Symlinks and special files are never removed by this protocol; the user must resolve them
outside the application. No automatic cleanup path may delete unvalidated non-empty bytes or the
only valid package. `J` remains while any such artifact awaits confirmation.

Every confirmed removal of a non-empty package-role candidate also carries the
persistence-selected survivor's role, exact observation token, and validated manifest fingerprint.
Rust binds those fields to the locked initial snapshot, checks the expected postcondition after every
step instead of adopting new ambient state, and refuses candidate cleanup unless that exact selected
package survives. Snapshot freshness alone is not deletion authority. Exact marker removal and
recognized cleanup of proven-empty scaffolding remain separately constrained by the state table.

### Stable recovery result codes

Issue #46 will expose these exact codes through the public persistence recovery result and validated
Tauri DTO. Existing issue #8 diagnostics remain nested on each invalid package candidate.

| Code                                               | Meaning                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `persistence.recovery.ambiguous-candidates`        | Two or more different valid fingerprints have no unambiguous marker decision     |
| `persistence.recovery.artifact-conflict`           | A role is invalid, unreadable, wrong-kind, mismatched, or in an impossible state |
| `persistence.recovery.artifact-name-invalid`       | The target or a derived sibling name cannot be represented safely                |
| `persistence.recovery.confirmation-required`       | A preserving choice exists but automatic mutation is not authorized              |
| `persistence.recovery.durability-failed`           | A required sync/full-flush failed after filesystem mutation                      |
| `persistence.recovery.durability-unsupported`      | The filesystem lacks a required lock, sync, full-flush, or no-replace capability |
| `persistence.recovery.fingerprint-mismatch`        | On-disk bytes do not match a marker or validated native write plan               |
| `persistence.recovery.io-failed`                   | A read, write, create, rename, or cleanup syscall failed                         |
| `persistence.recovery.marker-invalid`              | Marker bytes, fields, names, or operation are malformed or inconsistent          |
| `persistence.recovery.marker-version-incompatible` | `protocolVersion` is not implemented                                             |
| `persistence.recovery.no-valid-package`            | No role passes the complete issue #8 package contract                            |
| `persistence.recovery.operation-in-progress`       | Another cooperating operation holds the parent lock                              |
| `persistence.recovery.target-changed`              | Replacement target fingerprint differs from the caller's expected previous value |

Native failures also return the attempted primitive, artifact role, and OS error number/name as
non-stable context. User-facing behavior branches only on the stable code and structured fields,
never the platform message.

### Responsibility split

| Layer                      | Owns                                                                                                                                                                                                                          | Must not own                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@ttrpg-map/persistence`   | v1 encode/decode; fingerprint and marker schema; exact names; recovery codes; immutable candidate classification; pure state-machine decision and native-operation plan                                                       | File dialogs, Tauri invocation, OS syscalls, UI choice, generator execution                   |
| Desktop TypeScript adapter | Immutable save snapshot; expected previous fingerprint; validated Tauri DTOs; feeding native-read bytes to persistence; invoking returned plans; presenting conflicts and exact confirmations                                 | Parsing by ad hoc JSON, choosing by time/name, raw filesystem mutation, silent cleanup        |
| Tauri/Rust native code     | Parent locking; descriptor-relative no-follow enumeration; exclusive create/write/readback; file and directory sync; macOS barriers; no-replace renames; authorized cleanup; injected-failure hooks and structured OS context | World-document/schema interpretation, candidate selection policy, migration, regeneration, UI |

The normal save command may execute native preparation and commit in one invocation because the
candidate was already validated through `decodeMapworld`, its marker and fingerprints match the same
immutable plan, and native readback is exact. Reopen is two-phase: Rust returns the bounded artifact
snapshot, persistence validates and chooses a plan, and Rust re-locks and verifies that the snapshot
fingerprints, role kinds, and selected survivor identity are unchanged before applying it. Every
step has an exact expected postcondition and unaffected roles must remain byte-identical. Any change
causes `persistence.recovery.target-changed` or `fingerprint-mismatch`, not a stale plan execution.

## Consequences

### Positive

- Replacement never depends on overwriting a non-empty directory.
- The previous package stays valid under `T` or `B` until the new target name is durable.

### Negative

- Replacement needs two namespace renames, several directory syncs, and macOS full-flush barriers;
  saving is intentionally latency-heavier than a best-effort copy.
- A crash can temporarily leave the user-visible target name absent, although the old package remains
  discoverable at the exact backup name and reopen repairs it deterministically.
- Unsupported or weak filesystem semantics fail closed. Network, FUSE, and removable filesystems are
  not implicitly promised by successful ordinary writes.

### Neutral or follow-up

- Issue #46 implements this protocol and its failure-injection harness; this ADR adds no production
  filesystem code.
- Before claiming support beyond local APFS and the tested Linux filesystem, open a focused issue to
  define a supported-volume capability matrix, network/removable-volume UX, and evidence requirements.

## Compatibility and migration

- **Accepted world documents:** unchanged. Recovery moves complete packages and never rewrites
  canonical accepted records.
- **Persisted schemas and migrations:** `.mapworld` package and record versions remain `1`.
  `manifest.json` remains `recovery: { "mode": "none" }`; `J` is a sibling native journal, not a
  package file. Existing clean v1 packages require no migration.
- **Recovery compatibility:** recovery protocol version `1` is a new native/adapter compatibility
  promise. Readers encountering another version preserve its artifacts and report incompatibility.
- **Generator, seed, parameter, context, and style versions:** unchanged; no generator runs during
  save or recovery.
- **Canonical semantic/SVG/visual fixtures:** unchanged by this decision. Issue #46 adds recovery
  evidence without accepting new semantic, SVG, or PNG output.
- **macOS and Linux determinism:** marker bytes, fingerprinting, enumeration, and recovery planning are
  byte- and role-deterministic. OS-specific primitives implement the same observable state machine.
- **Parent and child maps:** remain one world-document package and are selected together only after
  the complete package validates.

## Validation

### Exhaustive failure-point matrix

The native test adapter numbers every externally visible operation below. `each` is a parameterized
injection point for every file, write chunk, directory, or cleanup entry, so adding a map file adds
cases rather than creating an untested gap. Tests inject both an error before the operation and
process termination immediately after it returns but before the next durability barrier.

| Point | Operation                                                        | First-save invariant                                | Replacement invariant                                                        |
| ----- | ---------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| P00   | Acquire parent lock; enumerate/preflight                         | No artifact changed                                 | `Vo` remains at `T`                                                          |
| P01   | Exclusive create and each write of `J`                           | `J` absent or invalid; no package existed           | `Vo` at `T`; `J` absent or invalid                                           |
| P02   | File-sync/full-sync `J`                                          | `J` may exist; no package existed                   | `Vo` at `T`                                                                  |
| P03   | Parent sync and macOS barrier for `J`                            | F0 or F1 after crash                                | R0 or R1 after crash; `Vo` at `T`                                            |
| P04   | Each `mkdir` in `W`                                              | No valid package until construction completes       | `Vo` at `T`                                                                  |
| P05   | Exclusive create and each partial/full authoritative write       | `W` absent/invalid; preserve it                     | `Vo` at `T`; `W` absent/invalid                                              |
| P06   | Each authoritative file `fsync`/`F_FULLFSYNC`                    | `W` absent/invalid until all validate               | `Vo` at `T`                                                                  |
| P07   | Each readback/path/length/byte/fingerprint verification          | `W` invalid or `Vn`; never delete non-empty failure | `Vo` at `T`; `W` invalid or `Vn`                                             |
| P08   | Each child-directory and `W` directory `fsync`                   | `W` invalid or `Vn`; marker retained                | `Vo` at `T`; marker retained                                                 |
| P09   | Parent sync and macOS barrier for prepared `W`                   | F1 or F2 after crash; valid `W` when F2             | R1 or R2 after crash; valid `Vo` and, at R2, `Vn`                            |
| P10   | First save `W -> T`, or replacement `T -> B` no-replace rename   | F2/F3/F4; `Vn` at `W` or `T`                        | R2/R3/R4; `Vo` at `T` or `B`, `Vn` at `W`                                    |
| P11   | Parent sync and macOS barrier after P10                          | F2 or committed F4                                  | R2 or R4; both `Vo` and `Vn` discoverable                                    |
| P12   | Replacement-only `W -> T` no-replace rename                      | Not applicable                                      | R4/R5/R6; `Vo` at `B`, `Vn` at `W` or `T`                                    |
| P13   | Replacement commit parent sync and macOS barrier                 | Not applicable                                      | R4 or committed R6; old remains until commit                                 |
| P14   | Each backup unlink, containing-directory sync, and child removal | Not applicable                                      | `Vn` opens; exact `Vo`/empty may clean, partial non-empty `B` stops with `J` |
| P15   | Parent sync and macOS barrier after backup removal               | Not applicable                                      | Committed `Vn` at `T`; R7 or R8                                              |
| P16   | Marker unlink                                                    | Committed `Vn` at `T`; `J` present or absent        | Committed `Vn` at `T`; `J` present or absent                                 |
| P17   | Final parent sync and macOS barrier                              | Committed F4/F6                                     | Committed R8/R10                                                             |

For every termination case, a new process enumerates, validates through issue #8, and runs the pure
decision. It either applies an authorized automatic plan or returns a stable attention state, opens
the selected package when permitted, and repeats recovery to prove idempotence. For failures between
a rename and parent sync, the test accepts the documented pre- or post-rename namespace after a real
crash, but never a mixture that causes automatic deletion of unvalidated bytes or the only valid
package. A P14 interruption that leaves non-empty partial `B` must repeatedly preserve `B` and `J`
while opening committed `Vn` read-only; tests supply explicit candidate-specific confirmation for
every partial-cleanup occurrence and prove cleanup can then finish. Ordinary syscall-error injection
must assert the exact immediate state.

The matrix is combined with these adversarial states: invalid/partial `J`; unknown marker version;
each role as symlink, file, special node, unreadable directory, or case-colliding name; target changed
after planning; package missing/extra files; malformed UTF-8/JSON; checksum mismatch; two different
valid fingerprints; byte-identical duplicates; invalid partial backup cleanup; `ENOSPC`, `EIO`,
`EINTR`, `EACCES`, `EROFS`, `EXDEV`, unsupported sync, unsupported no-replace rename; and two
cooperating processes contending for the parent lock.

Named error injection enters the actual write, sync, full-flush, rename, and capability-probe seams
as an `io::Error`; the normal adapter must produce the stable code and structured OS context. A
synthetic unsupported-capability probe proves the preflight and mutation paths fail closed without a
copy/delete fallback. It is not evidence that an untested network, removable, or FUSE volume is
supported.

### Required platform evidence

Issue #46 is not complete until the same native integration suite passes:

1. on the current macOS CI image and a local APFS volume, exercising directory `fsync`,
   `F_FULLFSYNC`,
   `RENAME_EXCL | RENAME_NOFOLLOW_ANY`, process-kill recovery, and the complete P00–P17 matrix;
2. on Linux on the development/CI local filesystem with the filesystem type recorded, exercising
   regular-file and directory `fsync`, `RENAME_NOREPLACE`, process-kill recovery, and the same matrix;
3. with exact old/new manifest fingerprints asserted at each recovery result, plus byte equality and
   complete `decodeMapworld` reopen of the selected package;
4. with the target continuously checked so replacement interruption never leaves both `T` and `B`
   without a valid `Vo` before R6; and
5. with unsupported-capability responses injected at the real probe/sync/rename seams, proving a
   stable fail-closed result rather than a copy fallback.

CI process termination and syscall injection prove protocol logic and OS boundary behavior, not
literal sudden power loss or every storage device's firmware. macOS full-flush and directory barriers
are required specifically to make the strongest guarantee the documented API permits; remaining
hardware/filesystem limitations must be reported rather than hidden.

## Revisit conditions

Revisit when a supported filesystem cannot implement the required no-replace rename, directory sync,
or full-flush semantics; when measured save latency justifies an immutable-generation/pointer design;
when large binary chunks make directory staging impractical; or when the product commits to supported
network/removable storage or non-cooperating concurrent writers. A new package storage model or
recovery protocol supersedes this ADR explicitly and retains a non-destructive reader for version-1
markers.

## Out of scope

- Autosave timing, retention, and merge policy.
- Cloud synchronization, collaboration, network filesystems, and removable-volume support claims.
- Binary authoritative chunks, SQLite, archive packaging, and generalized migration UI.
- Generator upgrades, accepted-state reconciliation, undo/redo, and cache recovery.
- Linux or Windows application packaging; Linux remains required development and integration
  evidence.
- Coordination with non-cooperating external writers beyond revalidating role kind and fingerprint
  immediately before mutation and refusing an observed mismatch.
