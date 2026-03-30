#!/bin/sh
set -eu

MONGO_URI="${MONGO_URI:-mongodb://mongodb:27017}"
MONGO_DB="${MONGO_DB:-mirinae_attendance}"
ATTENDANCE_DIR="${ATTENDANCE_DIR:-/app/data/attendance}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

echo "[backup] service started"

while true; do
  TS=$(date +"%Y%m%d_%H%M%S")
  TARGET="$BACKUP_DIR/$TS"
  mkdir -p "$TARGET"

  echo "[backup] dumping mongodb to $TARGET"
  mongodump --uri="$MONGO_URI/$MONGO_DB" --out "$TARGET/mongodb"

  echo "[backup] archiving attendance data"
  tar -czf "$TARGET/attendance_data.tar.gz" -C "$ATTENDANCE_DIR" . || true

  echo "[backup] applying retention policy (${RETENTION_DAYS} days)"
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} \;

  echo "[backup] completed at $TS"
  sleep "$((INTERVAL_HOURS * 3600))"
done
