# Issue 87 measurement command transcript

All commands below were executed from the repository root. They are retained verbatim except that
the shell prompt is omitted. Observation-to-command mappings are recorded in `raw-results.json`.

## `frontmost-proof`

Used for `warmup-proof-frontmost` and `fresh-proof-1`:

```sh
pkill -x ttrpg-map-desktop || true
sleep 1
open -n "apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
sleep 3
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set frontmost to true' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'click button "Profile milestone-2-atlas-proof" of profileGroup' -e 'delay 10' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

## `frontmost-fragmented-islands`

Used for `fresh-fragmented-islands-1`:

```sh
pkill -x ttrpg-map-desktop || true
sleep 1
open -n "apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
sleep 3
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set frontmost to true' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'click button "Profile milestone-2-atlas-fragmented-islands" of profileGroup' -e 'delay 10' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

## `frontmost-control-max`

Used for `fresh-control-max-1`:

```sh
pkill -x ttrpg-map-desktop || true
sleep 1
open -n "apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
sleep 3
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set frontmost to true' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'click button "Profile milestone-2-atlas-control-max" of profileGroup' -e 'delay 10' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

## `pilot-foreground-lost`

Used for `pilot-proof-foreground-lost`. The click and receipt reads were separate invocations; the
sequence is retained because that separation invalidated the observation.

```sh
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'click button "Profile milestone-2-atlas-proof" of profileGroup' -e 'end tell' -e 'end tell'
sleep 6
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

The receipt command was then repeated after two additional six-second waits and one one-second wait:

```sh
sleep 6
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

```sh
sleep 6
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

```sh
sleep 1
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

## `pilot-process-ambiguous`

Used for `pilot-proof-process-ambiguous`. This command intentionally records the observed mistake:
it launched with `open -n` without first terminating the prior profiling process.

```sh
open -n "apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
sleep 3
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set frontmost to true' -e 'set profileGroup to group "Issue 87 temporary profiling controls" of group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'click button "Profile milestone-2-atlas-proof" of profileGroup' -e 'delay 10' -e 'return value of static text 1 of group "Issue 87 profile receipt" of profileGroup' -e 'end tell' -e 'end tell'
```

## Accessibility confirmation

The following command produced the retained visible-state confirmation after the control-maximum
profile:

```sh
osascript -e 'tell application "System Events"' -e 'tell process "ttrpg-map-desktop"' -e 'set frontmost to true' -e 'set atlasGroup to group "Atlas workshop" of group 1 of UI element 1 of scroll area 1 of group 1 of group 1 of window 1' -e 'set viewportGroup to group 9 of atlasGroup' -e 'return {name of image 1 of viewportGroup, value of static text 1 of group 1 of viewportGroup, enabled of button "Accept full atlas" of group "Atlas generation operations" of atlasGroup}' -e 'end tell' -e 'end tell'
```
