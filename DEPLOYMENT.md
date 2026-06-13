# DWMS Deployment Guide (WinSCP + Linux Server)

This guide covers full production deployment for:
- Frontend: React/Vite
- Backend: Django + DRF + Channels (WebSocket)
- Redis: Channels layer for notifications/chat
- Nginx: reverse proxy + static hosting
- Daphne: ASGI app server via systemd

---

## 1. Server Prerequisites

Run on server (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx redis-server mysql-client nodejs npm
```

Optional but useful:

```bash
sudo apt install -y git unzip
```

---

## 2. Upload Project (WinSCP)

1. Connect via WinSCP to your Linux server.
2. Upload project to:

```text
/var/www/dwms
```

Expected structure:

```text
/var/www/dwms/Back-End
/var/www/dwms/Front-End
```

---

## 3. Backend Setup (Django)

```bash
cd /var/www/dwms/Back-End
python3 -m venv env
source env/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install channels-redis==4.2.0
```

Run migrations + static collection:

```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

---

## 4. Environment Variables

Create env file:

```bash
sudo mkdir -p /etc/dwms
sudo nano /etc/dwms/dwms.env
```

Add values (edit for your server):

```env
DJANGO_SETTINGS_MODULE=config.settings
DEBUG=False
SECRET_KEY=replace-with-strong-secret
ALLOWED_HOSTS=your-domain.com,www.your-domain.com,server-ip
REDIS_URL=redis://127.0.0.1:6379/1
```

Note:
- Your current `settings.py` already supports `REDIS_URL`.
- If `REDIS_URL` is missing, it falls back to in-memory channels (not recommended for production).

---

## 5. Redis Setup

Enable and start Redis:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping
```

Expected output:

```text
PONG
```

---

## 6. Run Backend as systemd Service (Daphne)

Create service file:

```bash
sudo nano /etc/systemd/system/dwms-daphne.service
```

Paste:

```ini
[Unit]
Description=DWMS Daphne ASGI Service
After=network.target redis-server.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/dwms/Back-End
EnvironmentFile=/etc/dwms/dwms.env
ExecStart=/var/www/dwms/Back-End/env/bin/daphne -b 127.0.0.1 -p 8001 config.asgi:application
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dwms-daphne
sudo systemctl start dwms-daphne
sudo systemctl status dwms-daphne
```

View logs:

```bash
sudo journalctl -u dwms-daphne -f
```

---

## 7. Frontend Production Build

```bash
cd /var/www/dwms/Front-End
npm install
npm run build
```

Build output folder:

```text
/var/www/dwms/Front-End/dist
```

---

## 8. Frontend API Base URL (Important)

For production, frontend should call your live server, not localhost.

Preferred approach:
- Use relative API paths (example `/api`) behind Nginx.

If needed, update frontend axios base URL before build:

```js
baseURL: '/api'
```

Then rebuild frontend:

```bash
npm run build
```

---

## 9. Nginx Configuration (Frontend + API + WS)

Create site config:

```bash
sudo nano /etc/nginx/sites-available/dwms
```

Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com server-ip;

    root /var/www/dwms/Front-End/dist;
    index index.html;

    # Frontend SPA
    location / {
        try_files $uri /index.html;
    }

    # Django REST API
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Channels)
    location /ws/ {
        proxy_pass http://127.0.0.1:8001/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }

    # Django static/media
    location /static/ {
        alias /var/www/dwms/Back-End/static/;
    }

    location /media/ {
        alias /var/www/dwms/Back-End/media/;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/dwms /etc/nginx/sites-enabled/dwms
sudo nginx -t
sudo systemctl restart nginx
```

---

## 10. SSL (Recommended)

If domain is configured, install SSL:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 11. Verification Checklist

1. Backend service running:

```bash
sudo systemctl status dwms-daphne
```

2. Redis running:

```bash
redis-cli ping
```

3. Nginx healthy:

```bash
sudo nginx -t
sudo systemctl status nginx
```

4. Open app URL in browser.
5. Login works.
6. API calls return 200.
7. Notification bell works.
8. Withdrawal chat real-time updates work.

---

## 12. Update Deployment (When New Code Comes)

After uploading new code:

```bash
cd /var/www/dwms/Back-End
source env/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart dwms-daphne

cd /var/www/dwms/Front-End
npm install
npm run build
sudo systemctl reload nginx
```

---

## 13. Common Issues

### A) 401 Unauthorized loops
- Ensure frontend has latest token-refresh logic.
- Login once after deployment.
- Check backend clock/time sync.

### B) WebSocket not connecting
- Confirm Nginx `/ws/` block exists.
- Confirm Redis is running.
- Check browser console network WebSocket errors.

### C) `redis.exceptions.TimeoutError`
- Ensure server Redis is local and healthy (`redis-cli ping`).
- Verify `REDIS_URL` in `/etc/dwms/dwms.env`.
- Restart `dwms-daphne` after env changes.

### D) Missing DB column errors after deploy
- Run migrations:

```bash
python manage.py migrate
```

---

## 14. Useful Commands

Service status:

```bash
sudo systemctl status dwms-daphne
sudo systemctl status nginx
sudo systemctl status redis-server
```

Restart services:

```bash
sudo systemctl restart dwms-daphne
sudo systemctl restart nginx
sudo systemctl restart redis-server
```

Live logs:

```bash
sudo journalctl -u dwms-daphne -f
sudo tail -f /var/log/nginx/error.log
```

---

Deployment guide complete.
