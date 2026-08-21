#!/bin/zsh
# Issue #88 only: run one clean packaged preview observation and retain raw RSS samples.
set -euo pipefail

if (( $# != 2 )); then
  print -u2 "usage: $0 fixture-id run-id"
  exit 2
fi

fixture_id="$1"
run_id="$2"
repo_root="$(cd "${0:A:h:h:h:h}" && pwd)"
app_path="$repo_root/apps/desktop/src-tauri/target/release/bundle/macos/TTRPG Map Generator.app"
executable_path="$app_path/Contents/MacOS/ttrpg-map-desktop"
sampler_path="/private/tmp/issue88-rss-timeline"
evidence_dir="$repo_root/docs/investigations/issue-84/preview-gate-2026-08-20"
csv_path="$evidence_dir/$run_id.csv"
sampler_log_path="$evidence_dir/$run_id.sampler.log"

if [[ ! -x "$executable_path" || ! -x "$sampler_path" ]]; then
  print -u2 "missing clean packaged executable or compiled sampler"
  exit 2
fi

mkdir -p "$evidence_dir"
pkill -x ttrpg-map-desktop || true
sleep 1

open -n "$app_path"
sleep 5

app_pids=("${(@f)$(pgrep -x ttrpg-map-desktop)}")
helper_pids=("${(@f)$(pgrep -f 'com\.apple\.WebKit\.(GPU|Networking|WebContent)' | awk -v app_pid="$app_pids[1]" '$1 > app_pid && $1 <= app_pid + 20')}")

if (( ${#app_pids} != 1 || ${#helper_pids} != 3 )); then
  print "fixture=$fixture_id run=$run_id status=invalid-process-identity app_pids=${(j:,:)app_pids} helper_pids=${(j:,:)helper_pids}"
  exit 0
fi

pids=("${app_pids[@]}" "${helper_pids[@]}")
"$sampler_path" 3 5 "$csv_path" "${pids[@]}" 2>"$sampler_log_path" &
sampler_pid=$!
sleep 0.5

receipt=$(osascript - "$fixture_id" <<'APPLESCRIPT'
on setText(formGroup, fieldName, fieldValue)
  tell application "System Events"
    click (text field (fieldName) of formGroup)
    keystroke "a" using command down
    keystroke fieldValue
    key code 48
  end tell
end setText

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

on epochMilliseconds()
  return (do shell script "/usr/bin/perl -MTime::HiRes=time -e 'printf \"%.3f\", time * 1000'")
end epochMilliseconds

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
        my choosePopup(formGroup, "CONTINENT DISTRIBUTION", 1, 0)
        my choosePopup(formGroup, "OCEAN CONNECTIVITY", 2, 0)
        my choosePopup(formGroup, "POLAR CHARACTER", 0, 1)
      else if fixtureId is not "milestone-2-atlas-proof" then
        error "unsupported fixture: " & fixtureId
      end if
      delay 0.5
      set dispatchEpochMs to my epochMilliseconds()
      click button "Generate coarse preview" of group "Atlas generation operations" of atlasGroup
      set painted to false
      repeat while painted is false
        repeat with currentGroup in groups of atlasGroup
          if role description of currentGroup is "figure" then
            set viewportGroup to contents of currentGroup
            if name of image 1 of viewportGroup is "Disposable coarse atlas preview" then
              if value of static text 1 of group 1 of viewportGroup is "DISPOSABLE COARSE PREVIEW — not accepted, saveable, or promotable." then
                set painted to true
              end if
            end if
          end if
        end repeat
        if painted is false then
          delay 0.005
        end if
      end repeat
      set firstPaintEpochMs to my epochMilliseconds()
      if not painted then error "labelled preview did not appear within the observation window"
      return fixtureId & "|" & dispatchEpochMs & "|" & firstPaintEpochMs & "|" & (name of image 1 of viewportGroup) & "|" & (value of static text 1 of group 1 of viewportGroup) & "|" & (enabled of button "Accept full atlas" of group "Atlas generation operations" of atlasGroup)
    end tell
  end tell
end run
APPLESCRIPT
)

wait "$sampler_pid"
sampler_summary="$(cat -- "$sampler_log_path")"
print "fixture=$fixture_id run=$run_id status=valid pids=${(j:,:)pids} receipt=$receipt sampler=$sampler_summary csv=$csv_path"
