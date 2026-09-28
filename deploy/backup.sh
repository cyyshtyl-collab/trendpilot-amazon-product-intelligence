#!/usr/bin/env sh
set -eu

backup_dir=/opt/trendpilot/backups
timestamp=$(date +%Y%m%d-%H%M%S)
backup_file="${backup_dir}/trendpilot-${timestamp}.sql.gz"
partial_file="${backup_file}.partial"
umask 077
mkdir -p "$backup_dir"
trap 'rm -f "$partial_file"' EXIT INT TERM
docker exec trendpilot-db pg_dump -U trendpilot -d trendpilot | gzip > "$partial_file"
gzip -t "$partial_file"
test -s "$partial_file"
mv "$partial_file" "$backup_file"
trap - EXIT INT TERM
find "$backup_dir" -type f -name 'trendpilot-*.sql.gz' -mtime +14 -delete
echo "Backup created: $backup_file"
