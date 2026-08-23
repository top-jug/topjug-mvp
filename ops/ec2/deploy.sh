#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: deploy.sh <bucket> <git-sha>" >&2
  exit 1
fi

BUCKET="$1"
GIT_SHA="$2"
APP_ROOT="/opt/topjug"
RELEASE_DIR="$APP_ROOT/releases/$GIT_SHA"
ARCHIVE="/tmp/topjug-mvp-$GIT_SHA.tar.gz"

mkdir -p "$RELEASE_DIR"
aws s3 cp "s3://$BUCKET/releases/$GIT_SHA.tar.gz" "$ARCHIVE"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"
chown -R topjug:topjug "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"
systemctl restart topjug.service

for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
    rm -f "$ARCHIVE"
    find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -nr \
      | awk 'NR > 5 { print $2 }' \
      | xargs --no-run-if-empty rm -rf
    echo "Deployed $GIT_SHA"
    exit 0
  fi

  sleep 2
done

systemctl status topjug.service --no-pager || true
journalctl -u topjug.service -n 100 --no-pager || true
exit 1
