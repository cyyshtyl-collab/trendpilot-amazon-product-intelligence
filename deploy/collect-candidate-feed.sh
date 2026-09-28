#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$script_dir/runtime-env.sh"
resolve_runtime_env
secret=$(read_required_env AUTOMATION_SECRET)
feed_url=$(sed -n 's/^CANDIDATE_FEED_URL=//p' "$runtime_env" | tail -n 1)
test "${#secret}" -ge 32
test -n "${feed_url}" || exit 0
curl --fail --silent --show-error --request POST \
  -H "Authorization: Bearer ${secret}" \
  'http://127.0.0.1/api/automation/candidate-feed'
