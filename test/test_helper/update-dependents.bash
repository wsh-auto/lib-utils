#!/bin/bash

lib_utils_project_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/../.." && pwd
}

lib_utils_make_home() {
  local home_dir="$1"
  mkdir -p "$home_dir/mnt/mdr" "$home_dir/mnt/tt" "$home_dir/mnt/wsh"
}

lib_utils_write_package() {
  local dir="$1"
  local body="$2"
  mkdir -p "$dir"
  printf '%s\n' "$body" > "$dir/package.json"
}

lib_utils_make_bun_stub() {
  local bin_dir="$1"
  local log_file="$2"
  mkdir -p "$bin_dir"
  cat > "$bin_dir/bun" <<'BUN'
#!/bin/bash
set -euo pipefail
printf '%s\t%s\n' "$PWD" "$*" >> "$LIB_UTILS_BUN_LOG"
if [[ "${1:-}" == "link" ]]; then
  exit 0
fi
if [[ "${1:-}" == "run" && "${2:-}" == "with-lock:install" ]]; then
  printf '@mdr/lib-utils@github:wsh-auto/lib-utils#abcdef123456\n'
  exit 0
fi
printf 'unexpected bun invocation: %s\n' "$*" >&2
exit 9
BUN
  chmod +x "$bin_dir/bun"
  : > "$log_file"
}

lib_utils_run_update_dependents() {
  local home_dir="$1"
  local bin_dir="$2"
  shift 2
  HOME="$home_dir" PATH="$bin_dir:$PATH" LIB_UTILS_BUN_LOG="${LIB_UTILS_BUN_LOG:-$BATS_TEST_TMPDIR/bun.log}" \
    /bin/bash "$(lib_utils_project_root)/scripts/_LIB-UTILS_update-dependents" "$@"
}
