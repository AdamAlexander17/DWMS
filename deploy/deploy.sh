#!/usr/bin/env bash
# =============================================================================
# DWMS Production Deployment Script
# =============================================================================
# Run this on your Ubuntu production server as root (or with sudo)
# Domain: dwms.run.place
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_NAME="dwms"
DOMAIN="dwms.run.place"
DEPLOY_DIR="/opt/${PROJECT_NAME}"
REPO_URL=""  # Set your git repo URL here if using git pull
DB_NAME="dwms"
DB_USER="dwms_user"
SERVICE_USER="dwms"

echo "============================================="
echo "  DWMS Production Deployment"
echo "  Domain: ${DOMAIN}"
echo "============================================="

# ---------------------------------------------------------------------------
# Step 1: System packages
# ---------------------------------------------------------------------------
echo ""
echo "[1/10] Installing system packages..."
apt update
apt install -y \
    python3 python3-pip python3-venv \
    mysql-client libmysqlclient-dev \
    redis-server \
    nginx certbot python3-certbot-nginx \
    nodejs npm \
    git curl wget \
    pkg-config build-essential

# ---------------------------------------------------------------------------
# Step 2: Create service user
# ---------------------------------------------------------------------------
echo ""
echo "[2/10] Creating service user..."
if ! id "${SERVICE_USER}" &>/dev/null; then
    useradd --system --shell /bin/bash --home "${DEPLOY_DIR}" --create-home "${SERVICE_USER}"
    usermod -aG www-data "${SERVICE_USER}"
fi

# ---------------------------------------------------------------------------
# Step 3: Create directory structure
# ---------------------------------------------------------------------------
echo ""
echo "[3/10] Setting up directory structure..."
mkdir -p "${DEPLOY_DIR}"
mkdir -p /var/log/${PROJECT_NAME}

# Copy project files (or git clone)
# If deploying from local, use scp/rsync beforehand
# Example: rsync -avz --exclude='node_modules' --exclude='env' . root@server:/opt/dwms/

# ---------------------------------------------------------------------------
# Step 4: Python virtual environment & dependencies
# ---------------------------------------------------------------------------
echo ""
echo "[4/10] Setting up Python environment..."
cd "${DEPLOY_DIR}/Back-End"

python3 -m venv "${DEPLOY_DIR}/venv"
source "${DEPLOY_DIR}/venv/bin/activate"

pip install --upgrade pip
pip install -r requirements.txt
pip install daphne gunicorn

# ---------------------------------------------------------------------------
# Step 5: Environment file
# ---------------------------------------------------------------------------
echo ""
echo "[5/10] Setting up environment..."
if [ ! -f "${DEPLOY_DIR}/.env" ]; then
    echo "Creating .env file — YOU MUST EDIT THIS with real values!"
    cat > "${DEPLOY_DIR}/.env" << 'EOF'
DJANGO_SETTINGS_MODULE=config.settings_production
DJANGO_SECRET_KEY=CHANGE-ME-generate-with-python-c-import-secrets-print-secrets.token_urlsafe(50)
DB_NAME=dwms
DB_USER=dwms_user
DB_PASSWORD=CHANGE-ME
DB_HOST=localhost
DB_PORT=3306
REDIS_URL=redis://127.0.0.1:6379/0
ENCRYPTION_KEY=CHANGE-ME-generate-fernet-key
DOMAIN=dwms.run.place
EOF
    chmod 600 "${DEPLOY_DIR}/.env"
    echo ""
    echo "  *** IMPORTANT: Edit ${DEPLOY_DIR}/.env with your real passwords ***"
    echo ""
fi

# Source env for remaining commands
set -a
source "${DEPLOY_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Step 6: Database setup
# ---------------------------------------------------------------------------
echo ""
echo "[6/10] Database setup..."
echo "Make sure your MySQL database '${DB_NAME}' exists and user '${DB_USER}' has access."
echo "If not done yet, run:"
echo "  mysql -u root -p -e \"CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
echo "  mysql -u root -p -e \"CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';\""
echo "  mysql -u root -p -e \"GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;\""
echo ""

# Run migrations
cd "${DEPLOY_DIR}/Back-End"
python manage.py migrate --settings=config.settings_production
python manage.py collectstatic --noinput --settings=config.settings_production

# ---------------------------------------------------------------------------
# Step 7: Build Frontend
# ---------------------------------------------------------------------------
echo ""
echo "[7/10] Building frontend..."
cd "${DEPLOY_DIR}/Front-End"
npm ci
npm run build

# ---------------------------------------------------------------------------
# Step 8: Redis
# ---------------------------------------------------------------------------
echo ""
echo "[8/10] Configuring Redis..."
systemctl enable redis-server
systemctl start redis-server
redis-cli ping  # Should say PONG

# ---------------------------------------------------------------------------
# Step 9: Systemd service
# ---------------------------------------------------------------------------
echo ""
echo "[9/10] Installing systemd service..."
cp "${DEPLOY_DIR}/deploy/dwms-daphne.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable dwms-daphne
systemctl restart dwms-daphne

echo "Waiting for Daphne to start..."
sleep 3
systemctl status dwms-daphne --no-pager || true

# ---------------------------------------------------------------------------
# Step 10: Nginx + SSL
# ---------------------------------------------------------------------------
echo ""
echo "[10/10] Configuring Nginx..."
cp "${DEPLOY_DIR}/deploy/nginx-dwms.conf" /etc/nginx/sites-available/dwms
ln -sf /etc/nginx/sites-available/dwms /etc/nginx/sites-enabled/dwms
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Get SSL certificate (first time only)
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    echo "Obtaining SSL certificate..."
    # Temporarily use HTTP-only config for certbot
    certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --email admin@${DOMAIN} --redirect
fi

systemctl restart nginx

# ---------------------------------------------------------------------------
# Set permissions
# ---------------------------------------------------------------------------
chown -R ${SERVICE_USER}:www-data "${DEPLOY_DIR}"
chmod -R 750 "${DEPLOY_DIR}"
chmod -R 770 "${DEPLOY_DIR}/Back-End/media"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  Deployment Complete!"
echo "============================================="
echo ""
echo "  URL:        https://${DOMAIN}"
echo "  API:        https://${DOMAIN}/api/"
echo "  Admin:      https://${DOMAIN}/admin/"
echo "  WebSocket:  wss://${DOMAIN}/ws/"
echo ""
echo "  Services:"
echo "    systemctl status dwms-daphne"
echo "    systemctl status nginx"
echo "    systemctl status redis-server"
echo ""
echo "  Logs:"
echo "    tail -f /var/log/dwms/daphne.log"
echo "    tail -f /var/log/nginx/access.log"
echo ""
echo "  NEXT STEPS:"
echo "    1. Edit /opt/dwms/.env with real passwords"
echo "    2. Restart: systemctl restart dwms-daphne"
echo "    3. Create superuser: python manage.py createsuperuser --settings=config.settings_production"
echo "============================================="
