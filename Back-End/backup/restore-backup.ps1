# =============================================================================
# DWMS Backup Restore Script (PowerShell - Windows)
# =============================================================================
# Description: Restore a DWMS backup to local MySQL database (dwms_backup)
# Usage:       .\restore-backup.ps1 -BackupFile <path-to-backup.sql.gz>
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,

    [string]$DBName = "dwms_backup",
    [string]$DBUser = "root",
    [string]$DBHost = "localhost",
    [string]$DBPort = "3306"
)

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

# Validate backup file
if (-not (Test-Path $BackupFile)) {
    Write-Log "ERROR: Backup file not found: $BackupFile"
    exit 1
}

if ($BackupFile -notmatch '\.sql\.gz$') {
    Write-Log "ERROR: Expected a .sql.gz file, got: $BackupFile"
    exit 1
}

# Check for checksum file
$ChecksumFile = "$BackupFile.sha256"
if (Test-Path $ChecksumFile) {
    Write-Log "Verifying SHA256 checksum..."
    $expectedHash = (Get-Content $ChecksumFile).Split(' ')[0]
    $actualHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLower()
    if ($expectedHash -ne $actualHash) {
        Write-Log "ERROR: Checksum mismatch!"
        Write-Log "  Expected: $expectedHash"
        Write-Log "  Actual:   $actualHash"
        exit 1
    }
    Write-Log "Checksum verification PASSED"
}

# Display info and confirm
$backupSize = (Get-Item $BackupFile).Length / 1MB
Write-Log "Backup file: $(Split-Path $BackupFile -Leaf)"
Write-Log ("Backup size: {0:N2} MB" -f $backupSize)
Write-Log "Target database: ${DBName}@${DBHost}:${DBPort}"
Write-Host ""

$confirm = Read-Host "This will DROP and recreate all tables in '$DBName'. Continue? (y/N)"
if ($confirm -notmatch '^[Yy]$') {
    Write-Log "Restore cancelled."
    exit 0
}

try {
    # Create database if it doesn't exist
    Write-Log "Ensuring database '$DBName' exists..."
    $createDbQuery = "CREATE DATABASE IF NOT EXISTS ``$DBName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    & mysql -u $DBUser -h $DBHost -P $DBPort -p -e $createDbQuery
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Failed to create/verify database"
        exit 1
    }

    # Find gzip tool (7zip or gzip from Git)
    $gzipPath = $null

    # Check for gzip (comes with Git for Windows)
    $gitGzip = Get-Command gzip -ErrorAction SilentlyContinue
    if ($gitGzip) { $gzipPath = "gzip" }

    # Check for 7-Zip
    $sevenZipPaths = @(
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )
    $sevenZip = $sevenZipPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    Write-Log "Restoring backup to '$DBName'..."
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    if ($gzipPath) {
        # Use gzip pipe
        $process = Start-Process -NoNewWindow -PassThru -Wait -FilePath "cmd.exe" `
            -ArgumentList "/c", "gzip -dc `"$BackupFile`" | mysql -u $DBUser -h $DBHost -P $DBPort -proot $DBName"
        if ($process.ExitCode -ne 0) {
            Write-Log "ERROR: Restore failed with exit code $($process.ExitCode)"
            exit 1
        }
    }
    elseif ($sevenZip) {
        # Use 7-Zip to decompress, pipe to mysql
        $tempSql = [System.IO.Path]::GetTempFileName() + ".sql"
        & $sevenZip e -so "$BackupFile" > $tempSql
        $cmd = "cmd /c `"mysql -u $DBUser -h $DBHost -P $DBPort -p $DBName < `"$tempSql`"`""
        Invoke-Expression $cmd
        Remove-Item $tempSql -ErrorAction SilentlyContinue
    }
    else {
        Write-Log "ERROR: No decompression tool found. Install Git for Windows (includes gzip) or 7-Zip."
        exit 1
    }

    $stopwatch.Stop()
    Write-Log "Restore completed successfully in $($stopwatch.Elapsed.TotalSeconds.ToString('F1')) seconds!"
    Write-Log "Database '$DBName' is now up to date."
}
catch {
    Write-Log "CRITICAL ERROR: $_"
    exit 1
}
