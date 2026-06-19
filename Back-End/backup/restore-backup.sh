#!/usr/bin/env bash
# =============================================================================
# DWMS Backup Restore Script
# =============================================================================
# Description: Restore a DWMS backup to local MySQL database (dwms_backup)
# Usage:       ./restore-backup.sh <path-to-backup.sql.gz>
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
LOCAL_DB_NAME="dwms_backup"
LOCAL_DB_USER="root"
LOCAL_DB_HOST="localhost"
LOCAL_DB_PORT="3306"

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

usage() {
    echo "Usage: $0 <path-to-backup.sql.gz>"
    echo ""
    echo "Restores a DWMS backup file to the local '${LOCAL_DB_NAME}' database."
    echo ""
    echo "Examples:"
    echo "  $0 ./dwms/backups/daily/dwms_20250619_100000.sql.gz"
    echo "  $0 /path/to/dwms_20250619_100000.sql.gz"
    exit 1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if [ $# -lt 1 ]; then
    usage
fi

BACKUP_FILE="$1"

# Validate backup file
if [ ! -f "${BACKUP_FILE}" ]; then
    log "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

if [[ ! "${BACKUP_FILE}" =~ \.sql\.gz$ ]]; then
    log "ERROR: Expected a .sql.gz file, got: ${BACKUP_FILE}"
    exit 1
fi

# Check gzip integrity
log "Verifying backup file integrity..."
if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
    log "ERROR: Backup file is corrupted: ${BACKUP_FILE}"
    exit 1
fi
log "File integrity OK"

# Check if checksum file exists alongside
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    log "Verifying SHA256 checksum..."
    EXPECTED_HASH=$(cat "${CHECKSUM_FILE}" | awk '{print $1}')
    ACTUAL_HASH=$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')
    if [ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]; then
        log "ERROR: Checksum mismatch!"
        log "  Expected: ${EXPECTED_HASH}"
        log "  Actual:   ${ACTUAL_HASH}"
        exit 1
    fi
    log "Checksum verification PASSED"
fi

# Confirm restore
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "Backup file: $(basename "${BACKUP_FILE}")"
log "Backup size: ${BACKUP_SIZE}"
log "Target database: ${LOCAL_DB_NAME}@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}"
echo ""
read -p "This will DROP and recreate all tables in '${LOCAL_DB_NAME}'. Continue? (y/N): " CONFIRM
if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
    log "Restore cancelled."
    exit 0
fi

# Create database if it doesn't exist
log "Ensuring database '${LOCAL_DB_NAME}' exists..."
mysql -u "${LOCAL_DB_USER}" -h "${LOCAL_DB_HOST}" -P "${LOCAL_DB_PORT}" -p \
    -e "CREATE DATABASE IF NOT EXISTS \`${LOCAL_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore the backup
log "Restoring backup to '${LOCAL_DB_NAME}'..."
RESTORE_START=$(date +%s)

gunzip -c "${BACKUP_FILE}" | mysql -u "${LOCAL_DB_USER}" -h "${LOCAL_DB_HOST}" -P "${LOCAL_DB_PORT}" -p "${LOCAL_DB_NAME}"

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))

log "Restore completed successfully in ${RESTORE_DURATION} seconds!"
log "Database '${LOCAL_DB_NAME}' is now up to date."
