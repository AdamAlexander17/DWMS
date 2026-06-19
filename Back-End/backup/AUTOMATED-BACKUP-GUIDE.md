# DWMS Automated Backup System — Detailed Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION SERVER (Ubuntu)                         │
│                                                                          │
│  ┌──────────┐    ┌───────────┐    ┌──────────────────────────────────┐  │
│  │  MySQL   │───>│ backup.sh │───>│ /var/backups/dwms/               │  │
│  │  (dwms)  │    │ (cron 10AM)│   │   ├── daily/   (7 days)         │  │
│  └──────────┘    └───────────┘    │   ├── weekly/  (4 weeks)        │  │
│                                   │   └── monthly/ (12 months)       │  │
│                                   └──────────────────────────────────┘  │
│                                            │                             │
└────────────────────────────────────────────┼─────────────────────────────┘
                                             │ SSH/SCP (10:30 AM)
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     LOCAL MACHINE (Windows/Linux/macOS)                   │
│                                                                          │
│  ┌────────────────┐    ┌──────────────────────────────────────────────┐ │
│  │ pull-backups   │───>│ Back-End/dwms/backups/                       │ │
│  │ (.ps1 or .sh)  │    │   ├── daily/                                │ │
│  │ (Task Scheduler│    │   ├── weekly/                               │ │
│  │  or cron)      │    │   └── monthly/                              │ │
│  └────────────────┘    └──────────────────────────────────────────────┘ │
│                                   │                                      │
│                                   ▼                                      │
│                        ┌──────────────────┐                             │
│                        │ restore-backup   │                             │
│                        │ → dwms_backup DB │                             │
│                        └──────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## GFS Rotation Strategy (Grandfather-Father-Son)

| Tier | Frequency | Retention | Purpose |
|------|-----------|-----------|---------|
| Daily (Son) | Every day | 7 days | Point-in-time recovery for recent issues |
| Weekly (Father) | Every Sunday | 4 weeks | Short-term archival |
| Monthly (Grandfather) | 1st of month | 12 months | Long-term archival, compliance |

---

## Detailed Setup Instructions

### Step 1: Create a Dedicated MySQL Backup User

On your production server, connect to MySQL as root:

```sql
-- Create read-only backup user
CREATE USER 'dwms_backup'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';

-- Grant minimum required privileges
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER 
  ON dwms.* TO 'dwms_backup'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify
SHOW GRANTS FOR 'dwms_backup'@'localhost';
```

**Why these permissions?**
- `SELECT` — Read table data
- `LOCK TABLES` — Required by mysqldump for consistent snapshots
- `SHOW VIEW` — Dump view definitions
- `EVENT` — Dump scheduled events
- `TRIGGER` — Dump trigger definitions

### Step 2: Configure MySQL Credentials File

```bash
# On the production server
cp /path/to/project/backup/my.cnf.example ~/.my.cnf

# Edit with your actual password
nano ~/.my.cnf

# CRITICAL: Restrict permissions (only owner can read)
chmod 600 ~/.my.cnf

# Verify permissions
ls -la ~/.my.cnf
# Should show: -rw------- 1 user user ...
```

### Step 3: Deploy Backup Script to Production

```bash
# Create the backup directory
sudo mkdir -p /opt/dwms/backup

# Copy the script
sudo cp backup.sh /opt/dwms/backup/backup.sh

# Make executable
sudo chmod +x /opt/dwms/backup/backup.sh

# Create backup storage directories
sudo mkdir -p /var/backups/dwms/{daily,weekly,monthly}

# Create log file
sudo touch /var/log/dwms-backup.log
sudo chmod 644 /var/log/dwms-backup.log

# Test the script manually
/opt/dwms/backup/backup.sh

# Verify output
ls -la /var/backups/dwms/daily/
cat /var/log/dwms-backup.log
```

### Step 4: Schedule via Cron

```bash
# Open crontab editor
crontab -e

# Add this line (runs daily at 10:00 AM server time):
0 10 * * * /opt/dwms/backup/backup.sh >> /var/log/dwms-backup.log 2>&1

# Verify cron entry
crontab -l
```

### Step 5: Generate SSH Key for Local Pull

**On Windows (PowerShell):**

```powershell
# Generate Ed25519 key (more secure than RSA)
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\dwms_backup" -C "dwms-backup-key"

# View the public key
Get-Content "$env:USERPROFILE\.ssh\dwms_backup.pub"

# Copy public key to server
type "$env:USERPROFILE\.ssh\dwms_backup.pub" | ssh root@<SERVER_IP> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

**On Linux/macOS:**

```bash
# Generate key
ssh-keygen -t ed25519 -f ~/.ssh/dwms_backup -C "dwms-backup-key"

# Copy to server
ssh-copy-id -i ~/.ssh/dwms_backup.pub root@<SERVER_IP>
```

### Step 6: Configure the Pull Script

Edit `pull-backups.ps1` (Windows) or `pull-backups.sh` (Linux/macOS):

```
$ServerIP = "203.0.113.50"    # Your actual server IP
```

Test the pull manually:

```powershell
# Windows
.\pull-backups.ps1

# Linux/macOS
chmod +x pull-backups.sh
./pull-backups.sh
```

### Step 7: Schedule Local Pull (Windows Task Scheduler)

```powershell
# Run as Administrator
.\setup-task-scheduler.ps1
```

This creates a task that runs daily at 10:30 AM (30 minutes after the server backup).

**For Linux/macOS (cron):**

```bash
# Add to crontab
crontab -e

# Pull at 10:30 AM daily
30 10 * * * /path/to/project/Back-End/backup/pull-backups.sh >> /path/to/project/Back-End/backup/pull.log 2>&1
```

### Step 8: Create Local Restore Database

```sql
-- On your local MySQL
CREATE DATABASE IF NOT EXISTS dwms_backup 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;
```

---

## Restoring a Backup

### Windows (PowerShell)

```powershell
# Restore latest daily backup
.\restore-backup.ps1 -BackupFile ".\dwms\backups\daily\dwms_20250619_100000.sql.gz"

# Restore to a different database
.\restore-backup.ps1 -BackupFile ".\dwms\backups\daily\dwms_20250619_100000.sql.gz" -DBName "dwms_test"
```

### Linux/macOS/WSL

```bash
chmod +x restore-backup.sh
./restore-backup.sh ./dwms/backups/daily/dwms_20250619_100000.sql.gz
```

---

## Security Considerations

### Credentials
- `~/.my.cnf` MUST have mode `600` (owner read/write only)
- Use a dedicated read-only MySQL user (`dwms_backup`)
- Never commit passwords to version control
- SSH keys should be passphrase-protected for additional security

### Network
- SSH key authentication only (no password auth)
- `BatchMode=yes` prevents interactive prompts and password fallback
- Consider restricting the backup SSH key to SCP-only via `authorized_keys`:
  ```
  command="scp -r /var/backups/dwms",no-pty,no-agent-forwarding ssh-ed25519 AAAA...
  ```

### Backup Integrity
- SHA256 checksums generated alongside every backup
- Gzip integrity verified after creation
- Checksums verified after download to local
- Minimum file size validation prevents empty dumps

---

## Monitoring and Alerts

### Check Backup Logs

```bash
# Server-side
tail -50 /var/log/dwms-backup.log

# Local pull
cat Back-End/backup/pull.log
```

### Simple Monitoring Script (Optional)

Add to cron to alert if backup is older than 25 hours:

```bash
#!/bin/bash
LATEST=$(find /var/backups/dwms/daily -name "*.sql.gz" -mmin -1500 | head -1)
if [ -z "$LATEST" ]; then
    echo "ALERT: No DWMS backup in the last 25 hours!" | mail -s "DWMS Backup Alert" admin@example.com
fi
```

---

## Troubleshooting

### "Access denied" during mysqldump
- Verify `~/.my.cnf` has correct credentials
- Check user grants: `SHOW GRANTS FOR 'dwms_backup'@'localhost';`
- Ensure file permissions: `chmod 600 ~/.my.cnf`

### SSH connection fails
- Test manually: `ssh -i ~/.ssh/dwms_backup -o BatchMode=yes root@<SERVER_IP> "echo OK"`
- Check if key is in `authorized_keys` on server
- Verify server firewall allows port 22
- Check SSH daemon logs: `journalctl -u sshd -f`

### Empty or corrupted backup
- Check disk space on server: `df -h /var/backups/`
- Check MySQL is running: `systemctl status mysql`
- Check for lock timeouts in the log file
- Run backup manually and watch output

### Task Scheduler not running (Windows)
- Check task status: `Get-ScheduledTask -TaskName "DWMS-Backup-Pull" | Format-List`
- Check history: Task Scheduler → DWMS-Backup-Pull → History tab
- Ensure "Run whether user is logged on or not" is configured
- Verify network connectivity at scheduled time

### Restore fails
- Ensure `dwms_backup` database exists
- Check MySQL max_allowed_packet if dump is large: `SET GLOBAL max_allowed_packet=1073741824;`
- Verify gzip is installed (Windows: comes with Git for Windows)
- Try decompressing manually first: `gzip -d -k backup.sql.gz`

---

## Disk Space Estimation

| Data Size | Compressed (~10:1) | Daily (7) | Weekly (4) | Monthly (12) | Total |
|-----------|--------------------:|----------:|-----------:|-------------:|------:|
| 100 MB | ~10 MB | 70 MB | 40 MB | 120 MB | ~230 MB |
| 500 MB | ~50 MB | 350 MB | 200 MB | 600 MB | ~1.15 GB |
| 1 GB | ~100 MB | 700 MB | 400 MB | 1.2 GB | ~2.3 GB |
| 5 GB | ~500 MB | 3.5 GB | 2 GB | 6 GB | ~11.5 GB |

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_NAME` | `dwms` | Project identifier |
| `DB_NAME` | `dwms` | Production database name |
| `BACKUP_BASE` | `/var/backups/dwms` | Server backup storage |
| `DAILY_RETENTION` | `7` | Days to keep daily backups |
| `WEEKLY_RETENTION` | `4` | Weeks to keep weekly backups |
| `MONTHLY_RETENTION` | `12` | Months to keep monthly backups |
| `SERVER_IP` | `<your-server-ip>` | Production server address |
| `SSH_KEY_PATH` | `~/.ssh/dwms_backup` | SSH key for authentication |
| `LOCAL_DB_NAME` | `dwms_backup` | Local restore target database |
