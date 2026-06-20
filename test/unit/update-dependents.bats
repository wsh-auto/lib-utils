#!/usr/bin/env bats

load '../test_helper/update-dependents'

setup() {
  PROJECT_ROOT="$(lib_utils_project_root)"
  TEST_HOME="$BATS_TEST_TMPDIR/home"
  TEST_BIN="$BATS_TEST_TMPDIR/bin"
  BUN_LOG="$BATS_TEST_TMPDIR/bun.log"
  lib_utils_make_home "$TEST_HOME"
  lib_utils_make_bun_stub "$TEST_BIN" "$BUN_LOG"
  export LIB_UTILS_BUN_LOG="$BUN_LOG"
}

@test "help prints wrapper usage without touching fake bun" {
  run /bin/bash "$PROJECT_ROOT/scripts/_LIB-UTILS_update-dependents" --help
  [[ "$status" -eq 0 ]]
  [[ "$output" == *"_LIB-UTILS_update-dependents"* ]]
  [[ "$output" == *"--links-only"* ]]
  [[ "$output" == *'AGENTS: MUST load $mdr:lib-utils before editing or for context'* ]]
  [[ ! -s "$BUN_LOG" ]]
}

@test "unknown option exits 4 with help hint" {
  run /bin/bash "$PROJECT_ROOT/scripts/_LIB-UTILS_update-dependents" --definitely-not-real
  [[ "$status" -eq 4 ]]
  [[ "$output" == *"Error: Unknown option: --definitely-not-real"* ]]
  [[ "$output" == *"Hint: _LIB-UTILS_update-dependents --help"* ]]
}

@test "agent context requires json output" {
  run env CODEX_THREAD_ID=fixture HOME="$TEST_HOME" PATH="$TEST_BIN:$PATH" \
    /bin/bash "$PROJECT_ROOT/scripts/_LIB-UTILS_update-dependents" --dry-run
  [[ "$status" -eq 4 ]]
  [[ "$output" == *"Agent context detected; rerun with --json for agent-safe output."* ]]
  [[ "$output" == *"Hint: _LIB-UTILS_update-dependents --help"* ]]
  [[ ! -s "$BUN_LOG" ]]
}

@test "dry-run json scans isolated home mnt and serializes workspace roots" {
  local solo workspace app json
  solo="$TEST_HOME/mnt/mdr/solo"
  workspace="$TEST_HOME/mnt/wsh/workspace"
  app="$workspace/packages/app"
  lib_utils_write_package "$solo" '{"name":"solo","dependencies":{"@mdr/lib-utils":"github:wsh-auto/lib-utils"}}'
  lib_utils_write_package "$workspace" '{"name":"workspace-root","workspaces":["packages/*"]}'
  lib_utils_write_package "$app" '{"name":"workspace-app","devDependencies":{"@mdr/lib-utils":"github:wsh-auto/lib-utils"}}'

  run lib_utils_run_update_dependents "$TEST_HOME" "$TEST_BIN" --dry-run --json
  [[ "$status" -eq 0 ]]
  json="$output"
  [[ "$(jq -r '.dryRun' <<<"$json")" == "true" ]]
  [[ "$(jq -r '.count' <<<"$json")" == "2" ]]
  jq -e --arg path "$solo" '.projects | index($path)' <<<"$json" >/dev/null
  jq -e --arg path "$workspace" '.projects | index($path)' <<<"$json" >/dev/null
  [[ ! -s "$BUN_LOG" ]]
}

@test "links-only json bootstraps link packages without installs" {
  local source_dir consumer_dir json
  source_dir="$TEST_HOME/mnt/mdr/lib-helpers"
  consumer_dir="$TEST_HOME/mnt/wsh/consumer"
  lib_utils_write_package "$source_dir" '{"name":"@mdr/lib-helpers"}'
  lib_utils_write_package "$consumer_dir" '{"name":"consumer","dependencies":{"@mdr/lib-helpers":"link:@mdr/lib-helpers"}}'

  run lib_utils_run_update_dependents "$TEST_HOME" "$TEST_BIN" --links-only --json
  [[ "$status" -eq 0 ]]
  json="$output"
  [[ "$(jq -r '.linksOnly' <<<"$json")" == "true" ]]
  [[ "$(jq -r '.ok' <<<"$json")" == "true" ]]
  [[ "$(wc -l < "$BUN_LOG" | tr -d ' ')" == "1" ]]
  [[ "$(<"$BUN_LOG")" == "$source_dir"$'\t'"link" ]]
}

@test "json mode updates isolated dependents and serializes project results" {
  local project_dir json
  project_dir="$TEST_HOME/mnt/mdr/consumer"
  lib_utils_write_package "$project_dir" '{"name":"consumer","dependencies":{"@mdr/lib-utils":"link:@mdr/lib-utils"}}'
  printf 'lock\n' > "$project_dir/bun.lock"
  mkdir -p "$project_dir/node_modules"

  run lib_utils_run_update_dependents "$TEST_HOME" "$TEST_BIN" --skip-links --json --clean
  [[ "$status" -eq 0 ]]
  json="$output"
  [[ "$(jq -r '.dryRun' <<<"$json")" == "false" ]]
  [[ "$(jq -r '.count' <<<"$json")" == "1" ]]
  [[ "$(jq -r '.success' <<<"$json")" == "1" ]]
  [[ "$(jq -r '.failed' <<<"$json")" == "0" ]]
  [[ "$(jq -r '.results[0].path' <<<"$json")" == "$project_dir" ]]
  [[ "$(jq -r '.results[0].ok' <<<"$json")" == "true" ]]
  [[ "$(jq -r '.results[0].version' <<<"$json")" == "abcdef1" ]]
  [[ "$(jq -r '.dependencies."@mdr/lib-utils"' "$project_dir/package.json")" == "github:wsh-auto/lib-utils" ]]
  [[ ! -e "$project_dir/bun.lock" ]]
  [[ ! -e "$project_dir/node_modules" ]]
  [[ "$(<"$BUN_LOG")" == "$project_dir"$'\t'"run with-lock:install" ]]
}
