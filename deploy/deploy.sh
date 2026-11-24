#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <image-tag>" >&2
  exit 2
fi

new_tag=$1
cd "$(dirname "$0")"

compose() {
  docker compose -f compose.production.yml "$@"
}

current_tag() {
  sed -n 's/^PULSE_TAG=//p' .env
}

set_tag() {
  sed -i.bak "s/^PULSE_TAG=.*/PULSE_TAG=$1/" .env
  rm -f .env.bak
}

domain=$(sed -n 's/^DOMAIN=//p' .env)
https_port=$(sed -n 's/^HTTPS_PORT=//p' .env)
https_port=${https_port:-443}

healthy() {
  curl -fsSk --max-time 10 --resolve "$domain:$https_port:127.0.0.1" "https://$domain:$https_port/api/health/ready" >/dev/null
}

previous_tag=$(current_tag)
echo "Deploying $new_tag (previous: ${previous_tag:-none})"

set_tag "$new_tag"

if compose pull caddy api worker migrate \
  && compose up -d --remove-orphans --wait --wait-timeout 180 \
  && healthy; then
  echo "Deployed $new_tag"
  docker image prune -f >/dev/null
  exit 0
fi

echo "Deploy of $new_tag failed, rolling back to $previous_tag" >&2
compose logs --tail 100 migrate api worker >&2 || true
set_tag "$previous_tag"
compose up -d --remove-orphans --wait --wait-timeout 180
exit 1
