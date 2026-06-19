# DWMS Automated Backup System

Quick-start guide for the DWMS production database backup and local sync system.

## Overview

| Component | Location | Schedule |
|-----------|----------|----------|
| Server backup | `/var/backups/dwms/` | Daily 10:00 AM |
| Local pull (Windows) | `Back-End/dwms/backups/` | Daily 10:30 AM |
| Local pull (Linux/macOS) | `Back-End/dwms/backups/` | Daily 10:30 AM |

## Quick Setup

### 1. Production Server (Ubuntu/Linux)

```bash
# Create backup user in MySQL
mysql -u root -p -e "
  CREATE USER 'dwms_backup'@'localhost' IDENTIFIED BY '<SECURE_PASSWORD>';
  GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON dwms.* TO 'dwms_backup'@'localhost';
  FLUSH PRIVILEGES;
"

# Setup credentials file
cp my.cnf.example ~/.my.cnf
nano ~/.my.cnf  # Set your password
chmod 600 ~/.my.cnf

# Deploy backup script
sudo mkdir -p /opt/dwms/backup
sudo cp backup.sh /opt/dwms/backup/
sudo chmod +x /opt/dwms/backup/backup.sh

# Create backup directories
sudo mkdir -p /var/backups/dwms/{daily,weekly,monthly}
sudo touch /var/log/dwms-backup.log

# Add cron job
echo "0 10 * * * /opt/dwms/backup/backup.sh >> /var/log/dwms-backup.log 2>&1" | crontab -

# Test
/opt/dwms/backup/backup.sh
```

### 2. Local Machine (Windows)

```powershell
# Generate SSH key for backups
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\dwms_backup" -C "dwms-backup-key"

# Copy public key to server
type "$env:USERPROFILE\.ssh\dwms_backup.pub" | ssh root@<SERVER_IP> "cat >> ~/.ssh/authorized_keys"

# Edit pull-backups.ps1 — set your server IP
# Then register the scheduled task (run as admin):
.\setup-task-scheduler.ps1
```

### 3. Restore a Backup Locally

```powershell
.\restore-backup.ps1 -BackupFile .\dwms\backups\daily\dwms_20250619_100000.sql.gz
```

## File Structure

```
backup/
├── backup.sh                  # Server-side backup script
├── pull-backups.ps1           # Windows pull script
├── pull-backups.sh            # Linux/macOS/WSL pull script
├── restore-backup.ps1         # Windows restore script
├── restore-backup.sh          # Linux/macOS restore script
├── setup-task-scheduler.ps1   # Windows Task Scheduler setup
├── my.cnf.example             # MySQL credentials template
├── README.md                  # This file
└── AUTOMATED-BACKUP-GUIDE.md  # Detailed setup guide
```

## See Also

For detailed instructions, troubleshooting, and architecture details, see **[AUTOMATED-BACKUP-GUIDE.md](./AUTOMATED-BACKUP-GUIDE.md)**.
