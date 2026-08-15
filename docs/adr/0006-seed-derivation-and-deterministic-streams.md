# ADR-0006 — Seed derivation and deterministic stream compatibility

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 1 needs independently rerollable generated aspects before the first synthetic
generator, transaction, or persisted `.mapworld` record can rely on random choices. The
[kernel-proof contract](../milestone-1-kernel-proof.md) fixes the world seed, aspect metadata,
and marker reroll boundary, while [ADR-0004](0004-stable-identity-grammar-and-derivation.md) and
[ADR-0005](0005-planet-and-regional-coordinate-contract.md) fix the identity and root-coordinate
inputs used here.

This decision resolves [issue #50](https://github.com/ChadHealey/ttrpg-map-generator/issues/50)
and is the compatibility contract implemented by
[issue #6](https://github.com/ChadHealey/ttrpg-map-generator/issues/6). It must prevent string
concatenation ambiguity, JavaScript number truncation, collection-order drift, and accidental
sharing of one sequential stream across aspects or child maps. It also must be implementable in
the DOM-free TypeScript kernel without a runtime dependency.

The streams defined here are deterministic procedural-generation tools, not cryptographic
random-number generators. A world seed is user-visible reproducibility input and is not secret.

## Decision drivers

- Identical validated inputs must produce identical bytes and samples on macOS and Linux.
- A selected aspect revision must change only that aspect's seed namespace.
- Root-coordinate and shared-boundary scopes must agree across child-map contexts that refer to
  the same physical point or portal.
- Every persisted input and behavior version must be inspectable and recoverable without a
  generator implementation.
- The kernel must not use ambient randomness, clocks, locale behavior, object-key ordering, or a
  third-party random/noise package.
- Integer and floating sample semantics must be precise enough for fixed compatibility vectors.

## Options considered

### Option A — Framed binary inputs, SHA-256, and xoshiro256**

Encode validated typed fields in one versioned binary grammar, hash them with SHA-256, and use
the four digest words as the state of a project-owned xoshiro256** stream. This adds small hash
and stream implementations, but every compatibility byte and operation can be specified and
tested without a dependency or platform API.

### Option B — Canonical JSON inputs and a 32-bit JavaScript PRNG

A positional JSON array would be readable and could avoid object-key ordering, but it would
still require a canonical number/string policy and UTF-8 boundary. Common 32-bit streams also
provide a smaller state and make unbiased sampling across the JavaScript safe-integer range
awkward. JSON is retained for later persistence, not used as the hash preimage.

### Option C — Adopt a third-party hash and random-stream package

A package could provide BLAKE3, PCG, or another established primitive. No current dependency is
already required by the kernel, and adopting one would make its exact release and transitive
implementation part of persisted-output compatibility. The small required surface does not
justify that dependency now.

### Option D — Web Crypto or host-native random facilities

Web Crypto can compute SHA-256, but its asynchronous host API is not uniformly available at all
DOM-free call sites and it does not define the procedural stream. Host random facilities are
explicitly incompatible with reproducibility. The algorithm is standard SHA-256, but its
kernel implementation remains synchronous and project-owned.

## Decision

Adopt Option A as seed-derivation version `1` and deterministic-stream version `1`.

### World seed representation

The external and persisted world seed is the canonical base-10 representation of an unsigned
64-bit integer in the closed range `0` through `18446744073709551615` (`2^64 - 1`). The only
accepted grammar is `0|[1-9][0-9]*`, followed by the range check. Leading zeroes, a sign,
whitespace, decimal points, exponent notation, and numeric JSON values are invalid rather than
normalized.

The in-memory `WorldSeed` is a distinct branded `bigint`. Parsing converts canonical text to
that type; formatting returns the unique canonical decimal text. APIs never accept a JavaScript
`number` as a world seed because not every value is exactly representable. Binary seed input
encodes the value as exactly eight unsigned big-endian bytes. The kernel-proof value
`81985529216486895` therefore encodes as `01 23 45 67 89 ab cd ef`.

### Versioned seed metadata and scope records

Every accepted generated aspect records:

- seed-derivation version;
- deterministic-stream version;
- declared seed scope;
- canonical world seed;
- generator ID and behavior version;
- aspect name and variant revision; and
- the validated fields for exactly one scope below.

`SeedDerivationVersion` and `DeterministicStreamVersion` are distinct positive, safe-integer
compatibility types. They cannot be substituted for generator or parameter-schema versions.
The derived 32-byte seed may be exposed as 64 lowercase hexadecimal characters for diagnostics
and fixtures. It is derived evidence, not a replacement for the authoritative metadata inputs.

The three scope inputs are closed discriminated records:

| Scope             | Discriminant | Scope-specific fields                                |
| ----------------- | ------------ | ---------------------------------------------------- |
| `map/entity`      | `1`          | `mapId: MapId`, `entityId: EntityId`                 |
| `root-coordinate` | `2`          | `rootSurfaceId: RootSurfaceId`, `point: PlanetPoint` |
| `shared-boundary` | `3`          | `boundaryPortalId: BoundaryPortalId`                 |

`RootSurfaceId` is a distinct stable UUID-backed identity using the canonical grammar and
validation rules of ADR-0004. It names one persisted root surface independently of a child-map
record or display name. It is added to the stable identity kinds by the seed implementation.

A root-coordinate key contains the already canonical signed 32-bit `longitudeTicks` and
`latitudeTicks` from ADR-0005. Raw radians, degrees, projected, regional, render, and screen
coordinates are invalid seed inputs. The root-coordinate namespace deliberately excludes child
map and entity IDs, so two child contexts produce the same seed for the same root surface,
canonical point, generator, aspect, revision, and world seed.

A shared-boundary namespace deliberately excludes either participating child map. Its stable
portal identity supplies the shared physical identity. A map/entity namespace includes both
the owning map and entity and is not shared across either boundary.

### Canonical seed-input encoding

Seed-input encoding version 1 starts with these exact 24 ASCII bytes including the terminating
zero byte:

```text
ttrpg-map/seed-input/v1\0
```

The prefix is followed by fields in the exact order shown below. Each field is framed as:

```text
tag:      1 unsigned byte
length:   4 unsigned big-endian bytes
payload:  exactly `length` bytes
```

Version 1 rejects missing, duplicate, reordered, unknown, or scope-inapplicable fields. It does
not sort caller-provided values or encode an object. Field tags, order, and payloads are:

| Order | Tag    | Field              | Payload                                                        |
| ----- | ------ | ------------------ | -------------------------------------------------------------- |
| 1     | `0x01` | scope              | one byte: `1`, `2`, or `3`                                     |
| 2     | `0x02` | world seed         | unsigned 64-bit big-endian integer                             |
| 3     | `0x03` | generator ID       | validated ASCII bytes, no terminator                           |
| 4     | `0x04` | generator version  | unsigned 64-bit big-endian integer                             |
| 5     | `0x05` | aspect name        | validated ASCII bytes, no terminator                           |
| 6     | `0x06` | variant revision   | unsigned 64-bit big-endian integer                             |
| 7a    | `0x10` | map ID             | 16 UUID bytes in RFC textual group order, with hyphens removed |
| 8a    | `0x11` | entity ID          | 16 UUID bytes in RFC textual group order, with hyphens removed |
| 7b    | `0x20` | root-surface ID    | 16 UUID bytes in RFC textual group order, with hyphens removed |
| 8b    | `0x21` | longitude ticks    | signed 32-bit big-endian two's-complement integer              |
| 9b    | `0x22` | latitude ticks     | signed 32-bit big-endian two's-complement integer              |
| 7c    | `0x30` | boundary-portal ID | 16 UUID bytes in RFC textual group order, with hyphens removed |

Rows `a`, `b`, and `c` are mutually exclusive scope suffixes. Generator versions and variant
revisions are safe integers today but use eight bytes so the grammar does not inherit a 32-bit
limit. All symbolic fields are already restricted to validated ASCII; there is no locale,
Unicode-normalization, delimiter, or object-key-order behavior at this boundary.

The derived aspect seed is the 32-byte SHA-256 digest of the complete encoded input. Digest
bytes and lowercase hexadecimal text use the standard SHA-256 byte order. There is no salt,
key, truncation, or second hash.

### Deterministic stream version 1

Stream version 1 is xoshiro256** with unsigned 64-bit operations. Split the 32 digest bytes
into `s0`, `s1`, `s2`, and `s3` as four consecutive unsigned big-endian words. If and only if
all four words are zero, replace `s3` with `1`; xoshiro's all-zero state is otherwise invalid.

For each raw draw, compute the returned value from the pre-transition state and then update the
state. Every addition, multiplication, shift, rotation, and exclusive-or is reduced to 64 bits:

```text
result = rotl64(s1 * 5, 7) * 9
t = s1 << 17

s2 = s2 xor s0
s3 = s3 xor s1
s1 = s1 xor s2
s0 = s0 xor s3
s2 = s2 xor t
s3 = rotl64(s3, 45)

return result
```

The public sample contract is:

- `nextUint64()` returns the next raw value as a `bigint` in `[0, 2^64)`.
- `nextUint32()` consumes one raw value and returns its most-significant 32 bits as an exact
  `number` in `[0, 2^32)`.
- `nextFloat64()` consumes one raw value, discards its 11 least-significant bits, and divides the
  remaining 53-bit integer by `2^53`, producing one of exactly `2^53` values in `[0, 1)`.
- `nextInt(maxExclusive)` accepts a positive safe integer at most `2^53 - 1`. Let
  `m = BigInt(maxExclusive)` and `limit = 2^64 - (2^64 mod m)`. It consumes raw values until one
  is less than `limit`, then returns `Number(value mod m)`. Rejection is observable stream
  consumption and removes modulo bias.

Each generator proposal receives a newly initialized stream through its explicit generation
context. Streams expose no global singleton, implicit default seed, public state mutation, or
ambient source. Callers that need an independent concern derive another complete typed seed
namespace; they do not split or borrow draws from another aspect's stream. Repeating a proposal
from the same accepted inputs therefore starts from the same state.

### Variant isolation

Variant revision is field `0x06` inside the complete aspect namespace. Rerolling one aspect
increments only that accepted aspect's revision before deriving its replacement stream. No
parent seed or shared sequential stream advances, and no other aspect metadata changes. The
revision-0 and revision-1 kernel-proof vectors below differ in exactly the eight-byte revision
payload and consequently produce unrelated digest and sample sequences while retaining the
same marker identities.

## Fixed compatibility vectors

All vectors use world seed `81985529216486895`, generator ID `proof.markers`, generator version
`1`, and aspect name `proof.markers`. The map/entity vectors use the fixed kernel-proof map and
entity IDs. The root vector uses root-surface ID `41c0988c-d65f-4dab-a064-fc8a8755eaec` and the
canonical seam point `(-2147483648, 0)`. The shared vector uses boundary-portal ID
`7f59b4c3-bf70-42b5-9b5e-c97f7e8d8321`.

| Vector          | Revision | Encoded bytes | SHA-256 derived seed                                               |
| --------------- | -------- | ------------- | ------------------------------------------------------------------ |
| map/entity r0   | 0        | 147           | `1a2f8b58dd15bc73225e165c502a3b05f27c71466b375d6e7ec01f1977040d56` |
| map/entity r1   | 1        | 147           | `00848c0bb927d5ef71c768a0ab25c62dd1c2492ad9b79f694229851e85083367` |
| root-coordinate | 0        | 144           | `e0df5749db434e06a7fc283ea57833b3fe11c35e389576f6d83f504c68822089` |
| shared-boundary | 0        | 126           | `9d7796bda6544cea685a288d2b4364410ed4d61dc182963d0b8a60c8afff2360` |

The first six `nextUint64()` values from a fresh stream are:

| Vector          | Sample 0               | Sample 1               | Sample 2               | Sample 3               | Sample 4               | Sample 5               |
| --------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| map/entity r0   | `4969472649965073277`  | `4126389313282449473`  | `12255398325814149716` | `6219055558446306254`  | `17257435883629250169` | `12766772300167332155` |
| map/entity r1   | `482482241414034812`   | `7331834249422374937`  | `5071566112739751929`  | `17259582541064106200` | `8692955153456199867`  | `13616984490983226921` |
| root-coordinate | `12216437898497178811` | `17692849315921094206` | `15229514985953005997` | `3414435803347387516`  | `15069927402757322134` | `2129342890703147323`  |
| shared-boundary | `17046239271336261284` | `7757445114682684189`  | `15827175737314354443` | `4320748786356295447`  | `5858308439689601826`  | `10457685005984530350` |

Applied independently to sample 0 of the map/entity-r0 stream, `nextUint32()` returns
`1157045515`, `nextFloat64()` returns `0.2693956521599714`, and `nextInt(1000)` returns `277`.
Each value comes from a separately initialized stream; calling those methods consecutively
would consume samples 0, 1, and 2 respectively.

Complete encoded preimages, shown without whitespace, are:

```text
map/entity r0
74747270672d6d61702f736565642d696e7075742f76310001000000010102000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b657273060000000800000000000000001000000010a6f9999609e84f5fbf5f80b6bb38bdb71100000010c6f4a17bdfaf4dce99049a900d300da4

map/entity r1
74747270672d6d61702f736565642d696e7075742f76310001000000010102000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b657273060000000800000000000000011000000010a6f9999609e84f5fbf5f80b6bb38bdb71100000010c6f4a17bdfaf4dce99049a900d300da4

root-coordinate
74747270672d6d61702f736565642d696e7075742f76310001000000010202000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b65727306000000080000000000000000200000001041c0988cd65f4daba064fc8a8755eaec210000000480000000220000000400000000

shared-boundary
74747270672d6d61702f736565642d696e7075742f76310001000000010302000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b6572730600000008000000000000000030000000107f59b4c3bf7042b59b5ec97f7e8d8321
```

## Consequences

### Positive

- Every namespace is unambiguous, inspectable, and independent of object or insertion order.
- The full unsigned-64 seed range survives UI, persistence, worker, and hash boundaries exactly.
- Direct SHA-256 state material gives the stream 256 bits without an additional expansion
  algorithm or dependency.
- Root-coordinate and portal results agree across child contexts without parent-generator
  reach-through.
- Exact raw integer vectors make stream compatibility failures easy to localize before they
  affect semantic fixtures.

### Negative

- Core owns compact SHA-256 and xoshiro256** implementations that require careful integer tests.
- `bigint` is required internally and must be converted explicitly at JSON boundaries.
- Xoshiro256** is not cryptographically secure and must never be presented as such.
- Changing even one namespace byte intentionally changes the entire downstream sequence.

### Neutral or follow-up

- Issue #6 implements the branded versions, scope records, encoder, hash, stream, fixtures, and
  narrow `Math.random()` lint extension.
- Persistence will encode world seeds as canonical decimal strings and validate any materialized
  derived-seed evidence against the authoritative inputs.
- Generators may build deterministic higher-level choices on the four guaranteed sampling
  methods, but those helpers require their own explicit compatibility semantics.

## Compatibility and migration

There is no released seed-bearing world-document schema or accepted generated fixture, so this
decision requires no migration and changes no existing semantic, SVG, or PNG fixture.

Once accepted output uses version 1:

- changing world-seed grammar, field framing, tags, field order, scope contents, UUID/tick byte
  order, SHA-256, or the all-zero-state mapping requires a new seed-derivation version;
- changing xoshiro state initialization, transition, returned word, or any guaranteed sampling
  method requires a new deterministic-stream version;
- changing an aspect from one seed scope to another also changes its generator behavior version
  and accepted seed metadata;
- changing planet tick canonicalization requires coordinated coordinate and seed-derivation
  compatibility decisions; and
- old accepted output remains materialized and loadable. A loader or newer generator may offer
  an explicit upgrade, but must never regenerate or rewrite it merely because a newer version
  exists.

The recorded derivation and stream versions determine how a requested reroll is reproduced. An
implementation that no longer supports an old version must report an actionable compatibility
diagnostic and preserve the accepted record. Parent edits may make a child context stale, but do
not alter the child's recorded seed metadata or accepted geography.

All specified operations are integer or byte operations except the final, exactly defined
`nextFloat64()` division. JavaScript uses the same binary64 semantics on supported macOS and
Linux runtimes; the integer vectors are the primary cross-platform evidence.

## Validation

Issue #6 must verify:

- the complete encoded preimages, SHA-256 digests, and six-word streams above;
- minimum, maximum, malformed, and noncanonical world-seed values;
- every stable-ID, symbolic-value, version, revision, and coordinate boundary;
- input field order and changes to each individual namespace field;
- same-input repetition and independent stream instances;
- revision isolation between two aspects;
- root seam, both canonical poles, and representative interior points;
- the same root point and portal reached through distinct child-context fixtures;
- `nextUint32`, `nextFloat64`, and rejection-sampled `nextInt` edge behavior; and
- the canonical fixture command and `pnpm check` on macOS and Linux.

The implementation must also keep the existing `Math.random()` prohibition for generation,
assets, and render and extend it only to deterministic-kernel modules added under core.

## Explicit exclusions

This decision does not choose a seeded-noise algorithm, geography generator, worker scheduling
policy, cache-key hash, cryptographic security API, stream jump/fork interface, arbitrary
Unicode seed labels, or a single map-wide sequential stream. It does not make generator-local
coordinates persistent and does not define automatic regeneration.

## Revisit conditions

- A measured generator workload shows that the specified stream is a material bottleneck.
- A cross-language production implementation cannot reproduce the fixed vectors without
  platform-specific behavior.
- A required generator needs deterministic stream partitioning that cannot be represented as a
  complete typed aspect namespace.
- Cryptographic unpredictability becomes a separate product requirement.
