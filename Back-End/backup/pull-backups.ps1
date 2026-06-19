# =============================================================================
# DWMS Backup Pull Script (PowerShell - Windows)
# =============================================================================
# Description: Mirrors production backups to local machine via SCP
# Schedule:    Daily at 10:30 AM via Windows Task Scheduler
# =============================================================================

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$ProjectName = "dwms"
$ServerIP = "<your-server-ip>"                          # Replace with your server IP
$SSHKeyPath = "$env:USERPROFILE\.ssh\dwms_backup"       # SSH private key path
$SSHUser = "root"                                       # SSH user on server (or dedicated backup user)
$RemoteBackupPath = "/var/backups/$ProjectName"
$LocalBackupPath = Join-Path $PSScriptRoot "..\..\$ProjectName\backups"
$LogFile = Join-Path $PSScriptRoot "pull.log"

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Write-Host $logEntry
    Add-Content -Path $LogFile -Value $logEntry
}

function Test-SSHConnection {
    try {
        $result = & ssh -i $SSHKeyPath -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${SSHUser}@${ServerIP}" "echo OK" 2>&1
        return ($result -match "OK")
    }
    catch {
        return $false
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
try {
    Write-Log "=========================================="
    Write-Log "Starting DWMS backup pull"
    Write-Log "=========================================="

    # Create local backup directory structure
    $directories = @("daily", "weekly", "monthly")
    foreach ($dir in $directories) {
        $localDir = Join-Path $LocalBackupPath $dir
        if (-not (Test-Path $localDir)) {
            New-Item -ItemType Directory -Path $localDir -Force | Out-Null
            Write-Log "Created directory: $localDir"
        }
    }

    # Test SSH connection
    Write-Log "Testing SSH connection to ${ServerIP}..."
    if (-not (Test-SSHConnection)) {
        Write-Log "ERROR: Cannot connect to server. Check SSH key and server availability."
        exit 1
    }
    Write-Log "SSH connection successful"

    # Pull backups for each GFS tier
    $totalFiles = 0
    $totalErrors = 0

    foreach ($dir in $directories) {
        Write-Log "Syncing ${dir} backups..."
        $localDir = Join-Path $LocalBackupPath $dir
        $remoteDir = "${SSHUser}@${ServerIP}:${RemoteBackupPath}/${dir}/"

        try {
            # Check if rsync is available (Git Bash / WSL)
            $rsyncPath = Get-Command rsync -ErrorAction SilentlyContinue

            if ($rsyncPath) {
                # Use rsync for efficient delta sync
                Write-Log "  Using rsync for ${dir}..."
                $rsyncArgs = @(
                    "-avz",
                    "--progress",
                    "-e", "ssh -i $SSHKeyPath -o BatchMode=yes -o StrictHostKeyChecking=accept-new",
                    $remoteDir,
                    ($localDir + "/")
                )
                $output = & rsync @rsyncArgs 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $fileCount = ($output | Select-String -Pattern "\.sql\.gz$").Count
                    $totalFiles += $fileCount
                    Write-Log "  Synced ${dir}: ${fileCount} backup file(s)"
                }
                else {
                    Write-Log "  WARNING: rsync returned exit code $LASTEXITCODE for ${dir}"
                    $totalErrors++
                }
            }
            else {
                # Fallback to SCP
                Write-Log "  Using scp for ${dir}..."

                # Get list of remote files
                $remoteFiles = & ssh -i $SSHKeyPath -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${SSHUser}@${ServerIP}" "ls ${RemoteBackupPath}/${dir}/ 2>/dev/null" 2>&1

                if ($LASTEXITCODE -eq 0 -and $remoteFiles) {
                    $filesToPull = $remoteFiles | Where-Object { $_ -match "\.(sql\.gz|sha256)$" }

                    foreach ($file in $filesToPull) {
                        $file = $file.Trim()
                        if ([string]::IsNullOrEmpty($file)) { continue }

                        $localFile = Join-Path $localDir $file
                        if (-not (Test-Path $localFile)) {
                            & scp -i $SSHKeyPath -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${SSHUser}@${ServerIP}:${RemoteBackupPath}/${dir}/${file}" "$localDir/" 2>&1 | Out-Null
                            if ($LASTEXITCODE -eq 0) {
                                $totalFiles++
                                Write-Log "  Downloaded: ${file}"
                            }
                            else {
                                Write-Log "  ERROR: Failed to download ${file}"
                                $totalErrors++
                            }
                        }
                    }
                }
                else {
                    Write-Log "  No files found in ${dir}/ (or directory doesn't exist yet)"
                }
            }
        }
        catch {
            Write-Log "  ERROR syncing ${dir}: $_"
            $totalErrors++
        }
    }

    # Verify local checksums
    Write-Log "Verifying local backup checksums..."
    $checksumFiles = Get-ChildItem -Path $LocalBackupPath -Recurse -Filter "*.sha256"
    $verified = 0
    $failed = 0

    foreach ($csFile in $checksumFiles) {
        $backupFile = $csFile.FullName -replace '\.sha256$', ''
        if (Test-Path $backupFile) {
            $expectedHash = (Get-Content $csFile.FullName).Split(' ')[0]
            $actualHash = (Get-FileHash -Path $backupFile -Algorithm SHA256).Hash.ToLower()
            if ($expectedHash -eq $actualHash) {
                $verified++
            }
            else {
                $failed++
                Write-Log "  CHECKSUM MISMATCH: $(Split-Path $backupFile -Leaf)"
            }
        }
    }
    Write-Log "Checksum verification: ${verified} passed, ${failed} failed"

    # Summary
    Write-Log "------------------------------------------"
    Write-Log "Pull completed!"
    Write-Log "  New files downloaded: ${totalFiles}"
    Write-Log "  Errors: ${totalErrors}"
    Write-Log "  Checksums verified: ${verified}/${($verified + $failed)}"
    Write-Log "=========================================="
    Write-Log ""

    if ($totalErrors -gt 0) {
        exit 1
    }
    exit 0
}
catch {
    Write-Log "CRITICAL ERROR: $_"
    Write-Log "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}
