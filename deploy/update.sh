#!/usr/bin/env bash
# =============================================================================
# DWMS Quick Update Script
# =============================================================================
# Use this for subsequent deployments after initial setup
# Pulls code, rebuilds, migrates, and restarts services
# =============================================================================

set -euo pipefail

DEPLOY_DIR="/opt/dwms"

echo "Updating DWMS..."

# Load environment
set -a
source "${DEPLOY_DIR}/.env"
set +a

# Activate venv
source "${DEPLOY_DIR}/venv/bin/activate"

# Backend: install deps, migrate, collect static
echo "[1/4] Updating backend..."
cd "${DEPLOY_DIR}/Back-End"
pip install -r requirements.txt --quiet
python manage.py migrate --settings=config.settings_production
python manage.py collectstatic --noinput --settings=config.settings_production

# Frontend: rebuild
echo "[2/4] Rebuilding frontend..."
cd "${DEPLOY_DIR}/Front-End"
npm ci --silent
npm run build

# Restart services
echo "[3/4] Restarting services..."
systemctl restart dwms-daphne

# Verify
echo "[4/4] Verifying..."
sleep 2
systemctl is-active dwms-daphne && echo "  Daphne: OK" || echo "  Daphne: FAILED"
systemctl is-active nginx && echo "  Nginx:  OK" || echo "  Nginx:  FAILED"
systemctl is-active redis-server && echo "  Redis:  OK" || echo "  Redis:  FAILED"

echo ""
echo "Update complete! Site: https://dwms.run.place"
