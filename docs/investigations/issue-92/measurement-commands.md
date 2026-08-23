# Issue 92 sanitized measurement command transcript

All commands were issued from the repository root. This transcript canonicalizes the executed
operations around stable public variables so that the operator-approved private archive root is
never disclosed. Substituting a row from the run-order table for `ISSUE92_RUN_ID` and
`ISSUE92_FIXTURE` yields the per-observation command. No command runs after observer dispatch until
the observer emits its final valid or invalid receipt.

## Stable identities and paths

```sh
ISSUE92_REPO_ROOT="$(git rev-parse --show-toplevel)"
ISSUE92_APP="$ISSUE92_REPO_ROOT/apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
ISSUE92_EXECUTABLE="$ISSUE92_APP/Contents/MacOS/ttrpg-map-desktop"
ISSUE92_CLEAN_EXECUTABLE_SHA=931235e8a989a3980533c7ba5387ba3622520762f3a05ae551856eb6eec116ee
ISSUE92_PROFILED_EXECUTABLE_SHA=c78fac6d0be1c35a2480122a88e83b0b8813fb289252a5718edf5842074ad33e
ISSUE92_CLEAN_OBSERVER=/private/tmp/issue92-clean-packaged-preview-observer
ISSUE92_PROFILED_OBSERVER=/private/tmp/issue92-profiled-packaged-preview-observer
ISSUE92_SAMPLER=/private/tmp/issue92-rss-timeline
ISSUE92_SAMPLER_SHA=6bea6159f116d77c8d9de7afd77a9c9bfac3961cc4e8f9316404fcb0b21e2555
ISSUE92_RETENTION=/private/tmp/issue92-preview-retention
ISSUE92_MODULE_CACHE=/private/tmp/issue92-swift-module-cache
```

`APPROVED_PRIVATE_ARCHIVE_ROOT` was separately supplied by the operator. Its value is private state
and is intentionally neither reproduced nor derivable here.

## Clean build and tool compilation

```sh
VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH=1 corepack pnpm \
  --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
test "$(shasum -a 256 "$ISSUE92_EXECUTABLE" | awk '{print $1}')" = \
  "$ISSUE92_CLEAN_EXECUTABLE_SHA"

mkdir -p "$ISSUE92_MODULE_CACHE"

clang -O2 -Wall -Wextra -Werror \
  -o "$ISSUE92_SAMPLER" \
  docs/investigations/issue-76/rss-timeline.c

xcrun swiftc -module-cache-path "$ISSUE92_MODULE_CACHE" \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit \
  -framework CoreMedia -framework CoreVideo -framework CryptoKit -framework Foundation \
  -o "$ISSUE92_CLEAN_OBSERVER" \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-platform.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-support.swift \
  docs/investigations/issue-90/packaged-preview-observer.swift

xcrun swiftc -module-cache-path "$ISSUE92_MODULE_CACHE" \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o /private/tmp/issue92-preview-retention-tests \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-retention-model.swift \
  docs/investigations/issue-90/packaged-preview-retention-core.swift \
  docs/investigations/issue-90/packaged-preview-retention-command.swift \
  docs/investigations/issue-90/packaged-preview-retention-tests.swift
/private/tmp/issue92-preview-retention-tests

xcrun swiftc -module-cache-path "$ISSUE92_MODULE_CACHE" \
  -warnings-as-errors -parse-as-library -framework CryptoKit \
  -o "$ISSUE92_RETENTION" \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-retention-model.swift \
  docs/investigations/issue-90/packaged-preview-retention-core.swift \
  docs/investigations/issue-90/packaged-preview-retention-command.swift \
  docs/investigations/issue-90/packaged-preview-retention.swift
```

The clean observer, sampler, and retention binary were then checked against the hashes recorded in
`raw-results.json`.

## Temporary probes and profiled build

The retained patch is the exact temporary source change. A clean checkout can reproduce the
profiled source state with:

```sh
git apply --check docs/investigations/issue-92/instrumentation.patch
git apply docs/investigations/issue-92/instrumentation.patch

corepack pnpm typecheck
corepack pnpm vitest run \
  packages/generation/src/atlas-land-water-generator-contract.test.ts \
  packages/generation/src/atlas-land-water-generator-invariants.test.ts \
  packages/generation/src/atlas-land-water-generator-operation.test.ts \
  packages/generation/src/atlas-land-water-progress.test.ts \
  apps/desktop/src/packaged-preview-dispatch.test.ts \
  apps/desktop/src/atlas-workflow.test.ts \
  apps/desktop/src/atlas-workflow-generation.integration.test.ts

xcrun swiftc -module-cache-path "$ISSUE92_MODULE_CACHE" \
  -warnings-as-errors -parse-as-library \
  -framework AppKit -framework ApplicationServices -framework ScreenCaptureKit \
  -framework CoreMedia -framework CoreVideo -framework CryptoKit -framework Foundation \
  -o "$ISSUE92_PROFILED_OBSERVER" \
  docs/investigations/issue-90/packaged-preview-observer-core.swift \
  docs/investigations/issue-90/packaged-preview-observer-platform.swift \
  docs/investigations/issue-90/packaged-preview-observer-rss.swift \
  docs/investigations/issue-90/packaged-preview-observer-security.swift \
  docs/investigations/issue-90/packaged-preview-observer-support.swift \
  docs/investigations/issue-90/packaged-preview-observer.swift

VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH=1 corepack pnpm \
  --filter @ttrpg-map/desktop tauri build --bundles app --no-sign --ci
test "$(shasum -a 256 "$ISSUE92_EXECUTABLE" | awk '{print $1}')" = \
  "$ISSUE92_PROFILED_EXECUTABLE_SHA"
```

## Fresh-process setup and pre-dispatch fixture verification

Each row started by closing any prior packaged candidate, opening one new process, waiting for its
WebKit helpers, and configuring the fixture before the observer began:

```sh
pkill -x ttrpg-map-desktop || true
sleep 1
open -n "$ISSUE92_APP"
sleep 5

osascript - "$ISSUE92_FIXTURE" <<'APPLESCRIPT'
on setText(formGroup, fieldName, fieldValue)
  tell application "System Events"
    click (text field (fieldName) of formGroup)
    keystroke "a" using command down
    keystroke fieldValue
    key code 48
    if value of (text field (fieldName) of formGroup) is not fieldValue then
      error "text control readback mismatch: " & fieldName
    end if
  end tell
end setText

on chooseAndVerify(formGroup, popupName, itemName)
  tell application "System Events"
    set popupControl to pop up button (popupName) of formGroup
    click popupControl
    click menu item (itemName) of menu 1 of popupControl
    if value of popupControl is not itemName then
      error "menu control readback mismatch: " & popupName
    end if
  end tell
end chooseAndVerify

on run argv
  set fixtureId to item 1 of argv
  tell application "System Events"
    tell process "ttrpg-map-desktop"
      set frontmost to true
      set atlasGroup to group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1
      set formGroup to group "Whole-world atlas controls" of atlasGroup

      if fixtureId is "milestone-2-atlas-fragmented-islands" then
        my setText(formGroup, "WORLD SEED · UNSIGNED 64-BIT INTEGER", "18364758544493064720")
        my setText(formGroup, "WATER COVERAGE · %", "70")
        my setText(formGroup, "CONTINENT-COUNT INTENT · COUNT", "5")
        my setText(formGroup, "FRAGMENTATION · %", "90")
        my setText(formGroup, "ISLAND ABUNDANCE · %", "95")
        my setText(formGroup, "ARCHIPELAGO ABUNDANCE · %", "95")
      else if fixtureId is "milestone-2-atlas-control-max" then
        my setText(formGroup, "WORLD SEED · UNSIGNED 64-BIT INTEGER", "16045690984503098046")
        my setText(formGroup, "CIRCUMFERENCE · KM", "80000")
        my setText(formGroup, "WATER COVERAGE · %", "80")
        my setText(formGroup, "CONTINENT-COUNT INTENT · COUNT", "8")
        my setText(formGroup, "FRAGMENTATION · %", "100")
        my setText(formGroup, "ISLAND ABUNDANCE · %", "100")
        my setText(formGroup, "ARCHIPELAGO ABUNDANCE · %", "100")
        my chooseAndVerify(formGroup, "CONTINENT DISTRIBUTION", "One dominant")
        my chooseAndVerify(formGroup, "OCEAN CONNECTIVITY", "Multiple basins")
        my chooseAndVerify(formGroup, "POLAR CHARACTER", "Ocean biased")
      else if fixtureId is not "milestone-2-atlas-proof" then
        error "unsupported fixture: " & fixtureId
      end if

      set frontmost to true
      delay 0.5
    end tell
  end tell
end run
APPLESCRIPT
```

The first three control-maximum attempts used this inherited native-menu key-navigation handler in
place of `chooseAndVerify`:

```applescript
on choosePopup(formGroup, popupName, downCount, upCount)
  tell application "System Events"
    click (pop up button (popupName) of formGroup)
    repeat downCount times
      key code 125
    end repeat
    repeat upCount times
      key code 126
    end repeat
    key code 36
  end tell
end choosePopup

my choosePopup(formGroup, "CONTINENT DISTRIBUTION", 1, 0)
my choosePopup(formGroup, "OCEAN CONNECTIVITY", 2, 0)
my choosePopup(formGroup, "POLAR CHARACTER", 0, 1)
```

Those menus remained at default values and intercepted the observer chord, so the attempts were
invalid. The retry rows used the separately clicked menu items and immediate value readback shown
above. Fixture identity was independently validated by the instrumented application's final profile
receipt. The AppleScript process exited before the observer command; it performed no post-dispatch
focus, scroll, pan, zoom, click, keyboard, or Accessibility operation.

## Observation and immediate private retention

For each mapped row, the following commands were run after pre-dispatch configuration:

```sh
ISSUE92_RAW_CSV="/private/tmp/${ISSUE92_RUN_ID}.csv"
ISSUE92_OBSERVER_RECEIPT="/private/tmp/${ISSUE92_RUN_ID}-observer.json"
ISSUE92_RETENTION_RECEIPT="/private/tmp/${ISSUE92_RUN_ID}-retention.json"

"$ISSUE92_PROFILED_OBSERVER" \
  app.ttrpgmap.generator \
  "$ISSUE92_PROFILED_EXECUTABLE_SHA" \
  "$ISSUE92_SAMPLER" \
  "$ISSUE92_SAMPLER_SHA" \
  "$ISSUE92_RAW_CSV" \
  "$ISSUE92_FIXTURE" \
  > "$ISSUE92_OBSERVER_RECEIPT"

test -n "$APPROVED_PRIVATE_ARCHIVE_ROOT"
test "$(stat -f '%Lp' "$APPROVED_PRIVATE_ARCHIVE_ROOT")" = 700

"$ISSUE92_RETENTION" \
  "$ISSUE92_REPO_ROOT" \
  "$ISSUE92_RAW_CSV" \
  "$APPROVED_PRIVATE_ARCHIVE_ROOT" \
  "$ISSUE92_RUN_ID" \
  > "$ISSUE92_RETENTION_RECEIPT"

test ! -e "$ISSUE92_RAW_CSV"
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' \
  "$ISSUE92_OBSERVER_RECEIPT"
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' \
  "$ISSUE92_RETENTION_RECEIPT"

cp "$ISSUE92_OBSERVER_RECEIPT" \
  "docs/investigations/issue-92/receipts/${ISSUE92_RUN_ID}-observer.json"
cp "$ISSUE92_RETENTION_RECEIPT" \
  "docs/investigations/issue-92/receipts/${ISSUE92_RUN_ID}-retention.json"
```

The observer emits a sanitized invalid receipt before returning failure for an invalid attempt. The
same retention command was therefore run after all 13 attempts regardless of observer status.

## Run-order mapping

| Order | `ISSUE92_RUN_ID`              | `ISSUE92_FIXTURE`                      | Setup variant          | Result        |
| ----: | ----------------------------- | -------------------------------------- | ---------------------- | ------------- |
|     1 | `issue92-proof-warmup`        | `milestone-2-atlas-proof`              | verified defaults      | valid warm-up |
|     2 | `issue92-proof-1`             | `milestone-2-atlas-proof`              | verified defaults      | valid         |
|     3 | `issue92-proof-2`             | `milestone-2-atlas-proof`              | verified defaults      | valid         |
|     4 | `issue92-proof-3`             | `milestone-2-atlas-proof`              | verified defaults      | valid         |
|     5 | `issue92-fragmented-1`        | `milestone-2-atlas-fragmented-islands` | text-field readback    | valid         |
|     6 | `issue92-fragmented-2`        | `milestone-2-atlas-fragmented-islands` | text-field readback    | valid         |
|     7 | `issue92-fragmented-3`        | `milestone-2-atlas-fragmented-islands` | text-field readback    | valid         |
|     8 | `issue92-control-max-1`       | `milestone-2-atlas-control-max`        | invalid key navigation | invalid       |
|     9 | `issue92-control-max-2`       | `milestone-2-atlas-control-max`        | invalid key navigation | invalid       |
|    10 | `issue92-control-max-3`       | `milestone-2-atlas-control-max`        | invalid key navigation | invalid       |
|    11 | `issue92-control-max-retry-1` | `milestone-2-atlas-control-max`        | menu click + readback  | valid         |
|    12 | `issue92-control-max-retry-2` | `milestone-2-atlas-control-max`        | menu click + readback  | valid         |
|    13 | `issue92-control-max-retry-3` | `milestone-2-atlas-control-max`        | menu click + readback  | valid         |

## Restoration and final verification

```sh
git apply --check --reverse docs/investigations/issue-92/instrumentation.patch
git apply --reverse docs/investigations/issue-92/instrumentation.patch

corepack pnpm test:cross-platform
corepack pnpm check
```

The source hashes after reversal matched the clean identities in `raw-results.json`. Temporary
runner state was then removed; the durable evidence keeps this sanitized transcript instead.
