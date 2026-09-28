#!/usr/bin/env bash
set -euo pipefail

archive=/opt/trendpilot/trendpilot-ecs-20260928-21.tgz
new_image=trendpilot-app:ecs-20260928.21
current=trendpilot-app
previous=trendpilot-app-prev-20260928-20-readiness

test -s "$archive"
gzip -dc "$archive" | docker load
/opt/trendpilot/backup.sh
docker image inspect "$new_image" >/dev/null
docker inspect "$current" >/dev/null

docker stop "$current" >/dev/null
docker rename "$current" "$previous"

rollback() {
  docker rm -f "$current" >/dev/null 2>&1 || true
  docker rename "$previous" "$current" >/dev/null 2>&1 || true
  docker start "$current" >/dev/null 2>&1 || true
}
trap rollback ERR

docker run -d \
  --name "$current" \
  --restart unless-stopped \
  --network trendpilot-net \
  --env-file /opt/trendpilot/app-runtime.env \
  -p 80:3000 \
  --memory=850m \
  --memory-reservation=512m \
  --memory-swap=1362m \
  "$new_image" >/dev/null

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1/ >/dev/null; then
    trap - ERR
    echo "DEPLOYED=$new_image"
    docker ps --filter "name=^/${current}$" --format 'STATUS={{.Status}} PORTS={{.Ports}}'
    exit 0
  fi
  sleep 1
done

echo 'Health check failed' >&2
false
