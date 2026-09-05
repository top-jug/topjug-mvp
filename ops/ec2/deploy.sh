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

release_is_healthy() {
  curl --fail --silent --connect-timeout 2 --max-time 5 http://127.0.0.1:3000/api/ready >/dev/null \
    && curl --fail --silent --connect-timeout 2 --max-time 5 http://127.0.0.1:3001/health >/dev/null
}

restore_previous_release() {
  if [[ -z "$PREVIOUS_RELEASE" || ! -d "$PREVIOUS_RELEASE" ]]; then
    systemctl stop topjug-admin.service topjug-web.service 2>/dev/null || true
    rm -f "$APP_ROOT/current"
    return
  fi

  ln -sfn "$PREVIOUS_RELEASE" "$APP_ROOT/current"
  if [[ -f "$PREVIOUS_RELEASE/apps/web/server.js" ]]; then
    systemctl disable --now topjug.service 2>/dev/null || true
    systemctl restart topjug-web.service topjug-admin.service
  else
    systemctl stop topjug-admin.service topjug-web.service 2>/dev/null || true
    systemctl enable --now topjug.service
  fi
  if [[ -f "$PREVIOUS_RELEASE/Caddyfile" ]]; then
    install -m 0644 "$PREVIOUS_RELEASE/Caddyfile" /etc/caddy/Caddyfile.rollback
    caddy validate --config /etc/caddy/Caddyfile.rollback
    mv /etc/caddy/Caddyfile.rollback /etc/caddy/Caddyfile
    systemctl reload caddy
  fi
  echo "Rolled back to $PREVIOUS_RELEASE" >&2
}

if [[ ! "$EXPECTED_ARCHIVE_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Invalid archive checksum" >&2
  exit 1
fi
if [[ -e "$RELEASE_DIR" ]]; then
  if [[ "$(readlink -f "$APP_ROOT/current" || true)" == "$RELEASE_DIR" ]]; then
    if release_is_healthy; then
      echo "Release $GIT_SHA is already deployed and healthy"
      DEPLOYED=true
      exit 0
    fi
    echo "Current release already exists but is not healthy: $RELEASE_DIR" >&2
    exit 1
  fi
  echo "Removing incomplete non-current release: $RELEASE_DIR"
  rm -rf "$RELEASE_DIR"
fi
mkdir -p "$RELEASE_DIR"
aws s3 cp "s3://$BUCKET/releases/$GIT_SHA.tar.gz" "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED_ARCHIVE_SHA256" "$ARCHIVE" | sha256sum -c -
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
chown -R topjug:topjug "$RELEASE_DIR"
install -m 0644 "$RELEASE_DIR/topjug-web.service" /etc/systemd/system/topjug-web.service
install -m 0644 "$RELEASE_DIR/topjug-admin.service" /etc/systemd/system/topjug-admin.service
install -m 0644 "$RELEASE_DIR/topjug-security-cleanup.service" /etc/systemd/system/topjug-security-cleanup.service
install -m 0644 "$RELEASE_DIR/topjug-security-cleanup.timer" /etc/systemd/system/topjug-security-cleanup.timer
install -m 0644 "$RELEASE_DIR/topjug-media-cleanup.service" /etc/systemd/system/topjug-media-cleanup.service
install -m 0644 "$RELEASE_DIR/topjug-media-cleanup.timer" /etc/systemd/system/topjug-media-cleanup.timer
install -m 0644 "$RELEASE_DIR/Caddyfile" /etc/caddy/Caddyfile.next
caddy validate --config /etc/caddy/Caddyfile.next
mv /etc/caddy/Caddyfile.next /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now topjug-security-cleanup.timer
systemctl enable --now topjug-media-cleanup.timer
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
systemctl disable --now topjug.service 2>/dev/null || true
if ! systemctl enable topjug-web.service topjug-admin.service; then
  restore_previous_release
  exit 1
fi
if ! systemctl restart topjug-web.service topjug-admin.service; then
  systemctl status topjug-web.service topjug-admin.service --no-pager || true
  restore_previous_release
  exit 1
fi

for attempt in {1..30}; do
  if release_is_healthy; then
    REFRESH_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' \
      --request POST --connect-timeout 2 --max-time 5 http://127.0.0.1:3000/api/v1/auth/refresh || true)"
    if [[ "$REFRESH_STATUS" == "401" ]]; then
      rm -f "$ARCHIVE"
      if ! systemctl reload caddy; then
        restore_previous_release
        exit 1
      fi
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

systemctl status topjug-web.service topjug-admin.service --no-pager || true
journalctl -u topjug-web.service -u topjug-admin.service -n 100 --no-pager || true
restore_previous_release
exit 1
