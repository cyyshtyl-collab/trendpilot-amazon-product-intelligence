#!/usr/bin/env sh
set -eu

secret=$(sed -n 's/^AUTOMATION_SECRET=//p' /opt/trendpilot/app.env)
test "${#secret}" -ge 32
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${secret}" \
  'http://127.0.0.1/api/automation/google-trends?geo=US'

