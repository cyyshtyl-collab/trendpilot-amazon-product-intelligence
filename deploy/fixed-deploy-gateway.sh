#!/usr/bin/env bash
set -Eeuo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
readonly base_dir=/opt/trendpilot
readonly incoming_dir="$base_dir/incoming"
readonly release_archive="$incoming_dir/release.tgz"
readonly current_container=trendpilot-app
readonly network=trendpilot-net
readonly env_file="$base_dir/app-runtime.env"
readonly lock_file=/var/lock/trendpilot-deploy.lock

status() {
  docker ps \
    --filter "name=^/${current_container}$" \
    --filter 'name=^/trendpilot-db$' \
    --format 'NAME={{.Names}} STATUS={{.Status}} IMAGE={{.Image}} PORTS={{.Ports}}'
  curl --fail --silent --show-error --max-time 10 \
    --output /dev/null http://127.0.0.1/
  docker exec trendpilot-db pg_isready -U trendpilot -d trendpilot
  echo 'STATUS=healthy'
}

upload() {
  umask 077
  mkdir -p "$incoming_dir"
  local temporary
  temporary="$(mktemp "$incoming_dir/release.XXXXXX.tgz")"
  trap 'rm -f "$temporary"' EXIT
  cat > "$temporary"
  local bytes
  bytes="$(stat -c '%s' "$temporary")"
  if (( bytes < 10240 || bytes > 1073741824 )); then
    echo 'Invalid release size' >&2
    exit 65
  fi
  gzip -t "$temporary"
  mv -f "$temporary" "$release_archive"
  trap - EXIT
  echo "UPLOADED_BYTES=$bytes"
}

deploy() {
  exec 9>"$lock_file"
  flock -n 9 || { echo 'Another deployment is running' >&2; exit 75; }
  test -s "$release_archive"
  test -s "$env_file"
  docker inspect trendpilot-db >/dev/null
  docker inspect "$current_container" >/dev/null

  local load_output image previous
  load_output="$(gzip -dc "$release_archive" | docker load)"
  image="$(printf '%s\n' "$load_output" | sed -n 's/^Loaded image: //p' | tail -n 1)"
  if [[ ! "$image" =~ ^trendpilot-app:ecs-[0-9]{8}\.[0-9]+$ ]]; then
    echo 'Release image name is not allowed' >&2
    exit 65
  fi
  docker image inspect "$image" >/dev/null
  "$base_dir/backup.sh"

  previous="trendpilot-app-prev-$(date +%Y%m%d-%H%M%S)"
  docker stop "$current_container" >/dev/null
  docker rename "$current_container" "$previous"

  rollback() {
    docker rm -f "$current_container" >/dev/null 2>&1 || true
    docker rename "$previous" "$current_container" >/dev/null 2>&1 || true
    docker start "$current_container" >/dev/null 2>&1 || true
  }
  trap rollback ERR

  docker run -d \
    --name "$current_container" \
    --restart unless-stopped \
    --network "$network" \
    --env-file "$env_file" \
    -p 80:3000 \
    --memory=850m \
    --memory-reservation=512m \
    --memory-swap=1362m \
    "$image" >/dev/null

  local attempt
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error --max-time 5 \
      --output /dev/null http://127.0.0.1/; then
      trap - ERR
      rm -f "$release_archive"
      echo "DEPLOYED=$image"
      status
      return 0
    fi
    sleep 1
  done

  echo 'Health check failed; rolling back' >&2
  false
}

case "${SSH_ORIGINAL_COMMAND:-}" in
  upload) upload ;;
  deploy) deploy ;;
  backup) "$base_dir/backup.sh" ;;
  status) status ;;
  *)
    echo 'Denied: this key is restricted to TrendPilot deployment operations' >&2
    exit 126
    ;;
esac
