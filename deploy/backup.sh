#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

backup_dir=${BACKUP_DIR:-./backups}
keep_days=${BACKUP_KEEP_DAYS:-14}
file="$backup_dir/pulse-$(date -u +%Y%m%dT%H%M%SZ).dump"

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

docker compose -f compose.production.yml exec -T postgres \
  pg_dump --username pulse --dbname pulse --format custom --no-owner >"$file.partial"
mv "$file.partial" "$file"
chmod 600 "$file"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$file" "${BACKUP_S3_URI%/}/$(basename "$file")" --only-show-errors
fi

find "$backup_dir" -name 'pulse-*.dump' -type f -mtime +"$keep_days" -delete

echo "$file"
