#!/usr/bin/env bash
# =============================================================================
# DWMS Production Database Backup Script
# =============================================================================
# Description: Automated MySQL backup with GFS rotation (Grandfather-Father-Son)
# Database:    dwms (production)
# Storage:     /var/backups/dwms/
# Schedule:    Daily at 10:00 AM via cron
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_NAME="dwms"
DB_NAME="dwms"
BACKUP_BASE="/var/backups/${PROJECT_NAME}"
LOG_FILE="/var/log/${PROJECT_NAME}-backup.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_DAY=$(date +"%u")        # 1=Monday ... 7=Sunday
DATE_DOM=$(date +"%d")        # Day of month (01-31)

# GFS Directories
DAILY_DIR="${BACKUP_BASE}/daily"
WEEKLY_DIR="${BACKUP_BASE}/weekly"
MONTHLY_DIR="${BACKUP_BASE}/monthly"

# Retention (number of backups to keep)
DAILY_RETENTION=7
WEEKLY_RETENTION=4
MONTHLY_RETENTION=12

# Backup file naming
BACKUP_FILE="${DB_NAME}_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${DB_NAME}_${TIMESTAMP}.sql.gz.sha256"

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

cleanup_old_backups() {
    local dir="$1"
    local keep="$2"
    local count

    count=$(find "${dir}" -name "*.sql.gz" -type f | wc -l)
    if [ "${count}" -gt "${keep}" ]; then
        log "Cleaning up ${dir}: keeping latest ${keep} of ${count} backups"
        find "${dir}" -name "*.sql.gz" -type f -printf '%T@ %p\n' | \
            sort -n | head -n -"${keep}" | awk '{print $2}' | \
            while read -r file; do
                rm -f "${file}" "${file}.sha256"
                log "  Removed: $(basename "${file}")"
            done
    fi
}

verify_backup() {
    local backup_path="$1"
    local checksum_path="$2"

    if [ ! -f "${backup_path}" ]; then
        log "ERROR: Backup file not found: ${backup_path}"
        return 1
    fi

    # Verify the file is not empty
    local size
    size=$(stat -f%z "${backup_path}" 2>/dev/null || stat -c%s "${backup_path}" 2>/dev/null)
    if [ "${size}" -lt 100 ]; then
        log "ERROR: Backup file suspiciously small (${size} bytes): ${backup_path}"
        return 1
    fi

    # Verify checksum
    if [ -f "${checksum_path}" ]; then
        if cd "$(dirname "${backup_path}")" && sha256sum -c "${checksum_path}" > /dev/null 2>&1; then
            log "Checksum verification PASSED"
        else
            log "ERROR: Checksum verification FAILED for ${backup_path}"
            return 1
        fi
    fi

    # Verify gzip integrity
    if gzip -t "${backup_path}" 2>/dev/null; then
        log "Gzip integrity check PASSED"
    else
        log "ERROR: Gzip integrity check FAILED for ${backup_path}"
        return 1
    fi

    return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
log "=========================================="
log "Starting DWMS database backup"
log "=========================================="

# Create directories if they don't exist
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}" "${MONTHLY_DIR}"

# Perform the database dump
log "Dumping database '${DB_NAME}'..."
DUMP_START=$(date +%s)

mysqldump \
    --defaults-file="${HOME}/.my.cnf" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-table \
    --complete-insert \
    --hex-blob \
    --set-gtid-purged=OFF \
    "${DB_NAME}" | gzip -9 > "${DAILY_DIR}/${BACKUP_FILE}"

DUMP_END=$(date +%s)
DUMP_DURATION=$((DUMP_END - DUMP_START))
log "Dump completed in ${DUMP_DURATION} seconds"

# Generate SHA256 checksum
log "Generating SHA256 checksum..."
cd "${DAILY_DIR}"
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
log "Checksum: $(cat "${CHECKSUM_FILE}")"

# Verify the backup
log "Verifying backup integrity..."
if ! verify_backup "${DAILY_DIR}/${BACKUP_FILE}" "${DAILY_DIR}/${CHECKSUM_FILE}"; then
    log "CRITICAL: Backup verification failed! Aborting."
    exit 1
fi

BACKUP_SIZE=$(du -h "${DAILY_DIR}/${BACKUP_FILE}" | cut -f1)
log "Backup size: ${BACKUP_SIZE}"

# ---------------------------------------------------------------------------
# GFS Rotation
# ---------------------------------------------------------------------------

# Weekly backup: Copy to weekly on Sundays (day 7)
if [ "${DATE_DAY}" -eq 7 ]; then
    log "Sunday detected — creating weekly backup copy"
    cp "${DAILY_DIR}/${BACKUP_FILE}" "${WEEKLY_DIR}/${BACKUP_FILE}"
    cp "${DAILY_DIR}/${CHECKSUM_FILE}" "${WEEKLY_DIR}/${CHECKSUM_FILE}"
fi

# Monthly backup: Copy to monthly on the 1st of each month
if [ "${DATE_DOM}" -eq "01" ]; then
    log "1st of month detected — creating monthly backup copy"
    cp "${DAILY_DIR}/${BACKUP_FILE}" "${MONTHLY_DIR}/${BACKUP_FILE}"
    cp "${DAILY_DIR}/${CHECKSUM_FILE}" "${MONTHLY_DIR}/${CHECKSUM_FILE}"
fi

# ---------------------------------------------------------------------------
# Retention Cleanup
# ---------------------------------------------------------------------------
log "Running retention cleanup..."
cleanup_old_backups "${DAILY_DIR}" "${DAILY_RETENTION}"
cleanup_old_backups "${WEEKLY_DIR}" "${WEEKLY_RETENTION}"
cleanup_old_backups "${MONTHLY_DIR}" "${MONTHLY_RETENTION}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "------------------------------------------"
log "Backup completed successfully!"
log "  File:     ${BACKUP_FILE}"
log "  Size:     ${BACKUP_SIZE}"
log "  Duration: ${DUMP_DURATION}s"
log "  Location: ${DAILY_DIR}/"
log "=========================================="
log ""

exit 0
