#!/bin/sh
set -eu

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production is missing" >&2
  exit 2
fi

set -a
. ./.env.production
set +a

: "${DOMAIN:?DOMAIN is required}"
: "${APP_URL:?APP_URL is required}"
: "${DATABASE_URL:?DATABASE_URL is required for migrations}"
: "${API_SECRET:?API_SECRET is required for webhook setup}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"

if [ -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ] && [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: a Supabase publishable or anon key is required" >&2
  exit 3
fi

case "$APP_URL" in
  "https://$DOMAIN") ;;
  *) echo "ERROR: APP_URL must equal https://DOMAIN" >&2; exit 3 ;;
esac

docker compose build app migrate
docker compose --profile tools run --rm migrate
docker compose up -d --remove-orphans app caddy

attempt=1
while [ "$attempt" -le 18 ]; do
  if wget --spider -q "https://$DOMAIN/"; then break; fi
  if [ "$attempt" -eq 18 ]; then
    docker compose logs --tail=120 app caddy
    echo "ERROR: production health check failed" >&2
    exit 4
  fi
  sleep 5
  attempt=$((attempt + 1))
done

response=$(wget -qO- --header="x-api-key: $API_SECRET" --post-data='' "https://$DOMAIN/api/telegram/set-webhook")
printf '%s' "$response" | grep -q '"webhookUrl"' || {
  echo "ERROR: webhook setup failed" >&2
  exit 5
}

docker compose ps
echo "Deployment, migration, HTTPS health check, and webhook setup completed."
