#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: deploy.sh <bucket> <git-sha> <archive-sha256>" >&2
  exit 1
fi

BUCKET="$1"
GIT_SHA="$2"
EXPECTED_ARCHIVE_SHA256="$3"
APP_ROOT="/opt/topjug"
RELEASE_DIR="$APP_ROOT/releases/$GIT_SHA"
ARCHIVE="/tmp/topjug-mvp-$GIT_SHA.tar.gz"
PREVIOUS_RELEASE="$(readlink -f "$APP_ROOT/current" || true)"
DEPLOYED=false

exec 9>/var/lock/topjug-deploy.lock
if ! flock --nonblock 9; then
  echo "Another TopJug deployment is already running" >&2
  exit 1
fi

cleanup() {
  rm -f "$ARCHIVE"
  if [[ "$DEPLOYED" != true && -d "$RELEASE_DIR" && "$(readlink -f "$APP_ROOT/current" || true)" != "$RELEASE_DIR" ]]; then
    rm -rf "$RELEASE_DIR"
  fi
}
trap cleanup EXIT

if [[ ! "$EXPECTED_ARCHIVE_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Invalid archive checksum" >&2
  exit 1
fi
if [[ -e "$RELEASE_DIR" ]]; then
  echo "Release already exists: $RELEASE_DIR" >&2
  exit 1
fi
mkdir -p "$RELEASE_DIR"
aws s3 cp "s3://$BUCKET/releases/$GIT_SHA.tar.gz" "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED_ARCHIVE_SHA256" "$ARCHIVE" | sha256sum -c -
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
chown -R topjug:topjug "$RELEASE_DIR"
install -m 0644 "$RELEASE_DIR/topjug.service" /etc/systemd/system/topjug.service
install -m 0644 "$RELEASE_DIR/topjug-security-cleanup.service" /etc/systemd/system/topjug-security-cleanup.service
install -m 0644 "$RELEASE_DIR/topjug-security-cleanup.timer" /etc/systemd/system/topjug-security-cleanup.timer
install -m 0644 "$RELEASE_DIR/Caddyfile" /etc/caddy/Caddyfile.next
caddy validate --config /etc/caddy/Caddyfile.next
mv /etc/caddy/Caddyfile.next /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now topjug-security-cleanup.timer
runuser -u topjug -- env \
  AWS_REGION=ap-northeast-2 \
  EMAIL_FROM_ADDRESS=no-reply@topjug.kr \
  EMAIL_IDENTITY_DOMAIN=topjug.kr \
  /usr/bin/node "$RELEASE_DIR/.migration/verify-production-email.cjs"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
systemctl restart topjug.service

for attempt in {1..30}; do
  if curl --fail --silent --connect-timeout 2 --max-time 5 http://127.0.0.1:3000/api/ready >/dev/null; then
    REFRESH_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' \
      --request POST --connect-timeout 2 --max-time 5 http://127.0.0.1:3000/api/v1/auth/refresh || true)"
    if [[ "$REFRESH_STATUS" == "401" ]]; then
      rm -f "$ARCHIVE"
      systemctl reload caddy
      find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
        | sort -nr \
        | awk 'NR > 5 { print $2 }' \
        | xargs --no-run-if-empty rm -rf
      echo "Deployed $GIT_SHA"
      DEPLOYED=true
      exit 0
    fi
  fi

  sleep 2
done

systemctl status topjug.service --no-pager || true
journalctl -u topjug.service -n 100 --no-pager || true
if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
  ln -sfn "$PREVIOUS_RELEASE" "$APP_ROOT/current"
  systemctl restart topjug.service
  echo "Rolled back to $PREVIOUS_RELEASE" >&2
else
  systemctl stop topjug.service
  rm -f "$APP_ROOT/current"
fi
exit 1
