# =============================================================================
# DWMS Backup Pull - Windows Task Scheduler Setup
# =============================================================================
# Run this script as Administrator to create the scheduled task
# =============================================================================

#Requires -RunAsAdministrator

$TaskName = "DWMS-Backup-Pull"
$Description = "Pull DWMS production backups to local machine daily at 10:30 AM"
$ScriptPath = Join-Path $PSScriptRoot "pull-backups.ps1"

# Remove existing task if present
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task '$TaskName'..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the action
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
    -WorkingDirectory $PSScriptRoot

# Create the trigger (daily at 10:30 AM)
$Trigger = New-ScheduledTaskTrigger -Daily -At "10:30AM"

# Create settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# Create the principal (run as current user)
$Principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType S4U `
    -RunLevel Highest

# Register the scheduled task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description $Description

Write-Host ""
Write-Host "Task '$TaskName' created successfully!" -ForegroundColor Green
Write-Host "  Schedule: Daily at 10:30 AM"
Write-Host "  Script:   $ScriptPath"
Write-Host ""
Write-Host "To verify: Get-ScheduledTask -TaskName '$TaskName' | Format-List"
Write-Host "To run now: Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "To remove:  Unregister-ScheduledTask -TaskName '$TaskName'"
