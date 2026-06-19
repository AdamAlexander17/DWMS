# DWMS Production Deployment Guide

## Domain: dwms.run.place

---

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Nginx (port 443)                                            │
│  ├── /              → React SPA (static files)               │
│  ├── /api/          → Daphne :8000 (Django REST)             │
│  ├── /admin/        → Daphne :8000 (Django Admin)            │
│  ├── /ws/           → Daphne :8000 (WebSocket upgrade)       │
│  ├── /static/       → /opt/dwms/Back-End/staticfiles/        │
│  └── /media/        → /opt/dwms/Back-End/media/              │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Daphne (ASGI Server) — port 8000                            │
│  ├── HTTP requests → Django REST Framework                   │
│  └── WebSocket    → Django Channels (deposits/withdrawals)   │
│                                                              │
│  Dependencies:                                               │
│  ├── MySQL (port 3306) — dwms database                       │
│  └── Redis (port 6379) — WebSocket channels + cache          │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites on Your Server

- Ubuntu 20.04+ (or Debian)
- MySQL already installed and running
- Root or sudo access
- Domain `dwms.run.place` pointed to your server IP (A record in DNS)

---

## Step-by-Step Deployment

### 1. Point Your Domain to the Server

In your DNS provider, add:
```
Type: A
Name: dwms.run.place
Value: <your-server-ip>
TTL: 300

Type: A  
Name: www.dwms.run.place
Value: <your-server-ip>
TTL: 300
```

Wait for DNS propagation (usually 5-15 minutes).

### 2. Upload Project to Server

From your Windows machine:

```powershell
# Using SCP (adjust paths)
scp -r C:\Users\mahme\OneDrive\Desktop\DWMS root@<your-server-ip>:/opt/dwms
```

Or use rsync (from WSL/Git Bash):
```bash
rsync -avz --exclude='node_modules' --exclude='env' --exclude='__pycache__' \
    /path/to/DWMS/ root@<server-ip>:/opt/dwms/
```

Or use Git on the server:
```bash
cd /opt
git clone <your-repo-url> dwms
```

### 3. Run the Deployment Script

SSH into your server:
```bash
ssh root@<your-server-ip>

# Make script executable
chmod +x /opt/dwms/deploy/deploy.sh

# Run it
/opt/dwms/deploy/deploy.sh
```

### 4. Configure Environment Variables

```bash
nano /opt/dwms/.env
```

Fill in real values:
```bash
DJANGO_SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(50))">
DB_PASSWORD=<your-mysql-password>
ENCRYPTION_KEY=<generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
```

### 5. Create MySQL Database and User

```bash
mysql -u root -p
```

```sql
CREATE DATABASE IF NOT EXISTS dwms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'dwms_user'@'localhost' IDENTIFIED BY 'YourSecurePassword';
GRANT ALL PRIVILEGES ON dwms.* TO 'dwms_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 6. Run Migrations and Create Superuser

```bash
cd /opt/dwms/Back-End
source /opt/dwms/venv/bin/activate
source /opt/dwms/.env

python manage.py migrate --settings=config.settings_production
python manage.py createsuperuser --settings=config.settings_production
```

### 7. Restart Everything

```bash
systemctl restart dwms-daphne
systemctl restart nginx
```

### 8. Verify

```bash
# Check services
systemctl status dwms-daphne
systemctl status nginx
systemctl status redis-server

# Test locally
curl -I https://dwms.run.place
curl https://dwms.run.place/api/schema/ -H "Accept: application/json"
```

---

## Accessing the Site

| URL | Purpose |
|-----|---------|
| https://dwms.run.place | Frontend (React app) |
| https://dwms.run.place/api/ | Backend API |
| https://dwms.run.place/admin/ | Django Admin |
| https://dwms.run.place/api/schema/swagger/ | API Documentation |
| wss://dwms.run.place/ws/ | WebSocket endpoint |

---

## Media Files (Uploaded QR Codes, etc.)

- Uploaded files are stored at `/opt/dwms/Back-End/media/`
- Nginx serves them at `https://dwms.run.place/media/`
- Users can view all uploaded files through the frontend as normal
- Directory permissions: `770` owned by `dwms:www-data`

---

## Subsequent Updates

After changing code, just run:
```bash
/opt/dwms/deploy/update.sh
```

This handles:
1. Installing new Python dependencies
2. Running database migrations
3. Rebuilding the React frontend
4. Restarting Daphne

---

## Useful Commands

```bash
# View logs
tail -f /var/log/dwms/daphne.log
tail -f /var/log/nginx/error.log
journalctl -u dwms-daphne -f

# Restart services
systemctl restart dwms-daphne
systemctl restart nginx

# Django shell
cd /opt/dwms/Back-End && source /opt/dwms/venv/bin/activate
python manage.py shell --settings=config.settings_production

# Check Redis
redis-cli ping  # PONG
redis-cli info memory

# Renew SSL (auto via certbot timer, but manual if needed)
certbot renew --dry-run
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 502 Bad Gateway | Check if Daphne is running: `systemctl status dwms-daphne` |
| Static files 404 | Run `python manage.py collectstatic --settings=config.settings_production` |
| Media files 404 | Check permissions: `chown -R dwms:www-data /opt/dwms/Back-End/media` |
| WebSocket fails | Check Nginx config has `proxy_set_header Upgrade` and Redis is running |
| SSL error | Run `certbot --nginx -d dwms.run.place` |
| Database error | Check `.env` DB_PASSWORD matches MySQL user password |
| Permission denied | Run `chown -R dwms:www-data /opt/dwms && chmod -R 750 /opt/dwms` |

---

## Firewall

Make sure these ports are open:
```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP (redirect to HTTPS)
ufw allow 443   # HTTPS
ufw enable
```

Do NOT expose port 8000, 3306, or 6379 to the internet. They only need localhost access.
