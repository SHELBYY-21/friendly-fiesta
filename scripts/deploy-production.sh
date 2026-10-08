#!/bin/sh
set -eu

# Approvals are supplied by the manually dispatched GitHub Actions workflow.
# Snapshot them before loading .env.production; an old server config must not
# silently turn migrations or webhook replacement back on.
run_migrations=${RUN_DB_MIGRATIONS:-false}
approved_migration_sha256=${APPROVED_MIGRATION_SHA256:-}
register_webhook=${REGISTER_TELEGRAM_WEBHOOK:-false}

case "$run_migrations" in true|false) ;; *) echo "Invalid migration approval" >&2; exit 2 ;; esac
case "$register_webhook" in true|false) ;; *) echo "Invalid webhook approval" >&2; exit 2 ;; esac

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production is missing" >&2
  exit 2
fi

set -a
. ./.env.production
set +a

: "${DOMAIN:?DOMAIN is required}"
: "${APP_URL:?APP_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"

if [ -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ] &&
   [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: a Supabase publishable or anon key is required" >&2
  exit 3
fi

case "$DOMAIN" in
  *[!A-Za-z0-9.-]* | -* | .* | *..* | *- | '') echo "ERROR: invalid DOMAIN" >&2; exit 3 ;;
esac
case "$APP_URL" in
  "https://$DOMAIN") ;;
  *) echo "ERROR: APP_URL must equal https://DOMAIN" >&2; exit 3 ;;
esac

if [ "$run_migrations" = true ]; then
  : "${DATABASE_URL:?DATABASE_URL is required for migrations}"
  case "$approved_migration_sha256" in
    *[!a-fA-F0-9]* | '') echo "ERROR: invalid migration checksum" >&2; exit 3 ;;
  esac
  if [ "${#approved_migration_sha256}" -ne 64 ]; then
    echo "ERROR: migration approval must be a 64-character SHA-256" >&2
    exit 3
  fi
  migration_file='supabase/patch-v17-sandbox-workflow.sql'
  actual_sha256=$(sha256sum "$migration_file" | cut -d ' ' -f 1)
  if [ "$actual_sha256" != "$approved_migration_sha256" ]; then
    echo "ERROR: migration file SHA-256 differs from the approved checksum" >&2
    exit 3
  fi
  docker compose build app migrate
  docker compose --profile tools run --rm migrate
else
  echo "DB migration skipped (not approved for this deploy)"
  docker compose build app
fi

# Do not remove unrelated containers, volumes or running services.
docker compose up -d app caddy

attempt=1
until wget -qO /dev/null --timeout=10 "https://$DOMAIN/api/health"; do
  if [ "$attempt" -ge 18 ]; then
    # Deployment logs might contain secrets or customer data: do not stream
    # raw container output back into public/shared GitHub Actions logs.
    echo "ERROR: API health check failed; investigate privately on VPS" >&2
    exit 4
  fi
  sleep 5
  attempt=$((attempt + 1))
done

if [ "$register_webhook" = true ]; then
  : "${API_SECRET:?API_SECRET is required for webhook setup}"
  response=$(wget -qO- --header="x-api-key: $API_SECRET" --post-data='' "https://$DOMAIN/api/telegram/set-webhook")
  printf '%s' "$response" | grep -q '"webhookUrl"' || {
    echo "ERROR: webhook setup failed" >&2
    exit 5
  }
else
  echo "Telegram webhook registration skipped (not approved for this deploy)"
fi

docker compose ps
echo "Production deploy passed HTTPS API health check. Migration/webhook approvals applied only when requested."
