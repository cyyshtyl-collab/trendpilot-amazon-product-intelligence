#!/usr/bin/env sh

# Resolves the production application environment file without exposing secrets.
resolve_runtime_env() {
  if [ -n "${TREND_PILOT_ENV_FILE:-}" ]; then
    runtime_env=$TREND_PILOT_ENV_FILE
  elif [ -f /opt/trendpilot/app-runtime.env ]; then
    runtime_env=/opt/trendpilot/app-runtime.env
  else
    runtime_env=/opt/trendpilot/app.env
  fi

  if [ ! -r "$runtime_env" ]; then
    echo "TrendPilot runtime environment file is not readable: $runtime_env" >&2
    return 1
  fi
}

# Reads one required value from the resolved environment file.
read_required_env() {
  key=$1
  value=$(sed -n "s/^${key}=//p" "$runtime_env" | tail -n 1)
  if [ -z "$value" ]; then
    echo "Required setting is missing: $key" >&2
    return 1
  fi
  printf '%s' "$value"
}
