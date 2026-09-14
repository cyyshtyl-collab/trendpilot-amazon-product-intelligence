#!/usr/bin/env sh
set -eu

backup_dir=/opt/trendpilot/backups
timestamp=$(date +%Y%m%d-%H%M%S)
umask 077
docker exec trendpilot-db pg_dump -U trendpilot -d trendpilot | gzip > "${backup_dir}/trendpilot-${timestamp}.sql.gz"
find "$backup_dir" -type f -name 'trendpilot-*.sql.gz' -mtime +14 -delete

