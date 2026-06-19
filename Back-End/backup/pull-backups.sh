#!/usr/bin/env bash
# =============================================================================
# DWMS Backup Pull Script (Bash - Linux/macOS/WSL)
# =============================================================================
# Description: Mirrors production backups to local machine via rsync/scp
# Schedule:    Daily at 10:30 AM (cron or launchd)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_NAME="dwms"
SERVER_IP="<your-server-ip>"                              # Replace with your server IP
SSH_KEY_PATH="${HOME}/.ssh/dwms_backup"                    # SSH private key path
SSH_USER="root"                                           # SSH user on server
REMOTE_BACKUP_PATH="/var/backups/${PROJECT_NAME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BACKUP_PATH="${SCRIPT_DIR}/../../${PROJECT_NAME}/backups"
LOG_FILE="${SCRIPT_DIR}/pull.log"

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

test_ssh_connection() {
    if ssh -i "${SSH_KEY_PATH}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SERVER_IP}" "echo OK" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
log "=========================================="
log "Starting DWMS backup pull"
log "=========================================="

# Resolve local backup path
LOCAL_BACKUP_PATH=$(cd "${LOCAL_BACKUP_PATH}" 2>/dev/null && pwd || mkdir -p "${LOCAL_BACKUP_PATH}" && cd "${LOCAL_BACKUP_PATH}" && pwd)

# Create local backup directory structure
for dir in daily weekly monthly; do
    mkdir -p "${LOCAL_BACKUP_PATH}/${dir}"
done

# Test SSH connection
log "Testing SSH connection to ${SERVER_IP}..."
if ! test_ssh_connection; then
    log "ERROR: Cannot connect to server. Check SSH key and server availability."
    exit 1
fi
log "SSH connection successful"

# Pull backups for each GFS tier
TOTAL_FILES=0
TOTAL_ERRORS=0

for dir in daily weekly monthly; do
    log "Syncing ${dir} backups..."

    if command -v rsync > /dev/null 2>&1; then
        # Use rsync for efficient delta sync
        rsync -avz --progress \
            -e "ssh -i ${SSH_KEY_PATH} -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
            "${SSH_USER}@${SERVER_IP}:${REMOTE_BACKUP_PATH}/${dir}/" \
            "${LOCAL_BACKUP_PATH}/${dir}/" 2>&1 | tee -a "${LOG_FILE}"

        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            FILE_COUNT=$(find "${LOCAL_BACKUP_PATH}/${dir}" -name "*.sql.gz" -type f | wc -l)
            log "  Synced ${dir}: ${FILE_COUNT} backup file(s) total"
        else
            log "  WARNING: rsync error for ${dir}"
            TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
        fi
    else
        # Fallback to SCP
        log "  rsync not available, using scp..."
        REMOTE_FILES=$(ssh -i "${SSH_KEY_PATH}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
            "${SSH_USER}@${SERVER_IP}" "ls ${REMOTE_BACKUP_PATH}/${dir}/ 2>/dev/null" 2>/dev/null || echo "")

        if [ -n "${REMOTE_FILES}" ]; then
            while IFS= read -r file; do
                file=$(echo "${file}" | tr -d '[:space:]')
                [ -z "${file}" ] && continue
                [[ "${file}" =~ \.(sql\.gz|sha256)$ ]] || continue

                local_file="${LOCAL_BACKUP_PATH}/${dir}/${file}"
                if [ ! -f "${local_file}" ]; then
                    if scp -i "${SSH_KEY_PATH}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
                        "${SSH_USER}@${SERVER_IP}:${REMOTE_BACKUP_PATH}/${dir}/${file}" \
                        "${LOCAL_BACKUP_PATH}/${dir}/" 2>/dev/null; then
                        TOTAL_FILES=$((TOTAL_FILES + 1))
                        log "  Downloaded: ${file}"
                    else
                        log "  ERROR: Failed to download ${file}"
                        TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
                    fi
                fi
            done <<< "${REMOTE_FILES}"
        else
            log "  No files found in ${dir}/ (or directory doesn't exist yet)"
        fi
    fi
done

# Verify local checksums
log "Verifying local backup checksums..."
VERIFIED=0
FAILED=0

find "${LOCAL_BACKUP_PATH}" -name "*.sha256" -type f | while read -r checksum_file; do
    backup_file="${checksum_file%.sha256}"
    if [ -f "${backup_file}" ]; then
        if cd "$(dirname "${checksum_file}")" && sha256sum -c "$(basename "${checksum_file}")" > /dev/null 2>&1; then
            VERIFIED=$((VERIFIED + 1))
        else
            FAILED=$((FAILED + 1))
            log "  CHECKSUM MISMATCH: $(basename "${backup_file}")"
        fi
    fi
done

# Summary
log "------------------------------------------"
log "Pull completed!"
log "  New files downloaded: ${TOTAL_FILES}"
log "  Errors: ${TOTAL_ERRORS}"
log "=========================================="
log ""

if [ "${TOTAL_ERRORS}" -gt 0 ]; then
    exit 1
fi

exit 0
