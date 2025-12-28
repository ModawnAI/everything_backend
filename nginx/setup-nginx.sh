#!/bin/bash
# =============================================
# Nginx Setup Script for 에뷰리띵 Backend
# Domains: api.e-beautything.com & admin.e-beautything.com
# =============================================

set -e

echo "============================================="
echo "Nginx Setup for 에뷰리띵 Backend"
echo "============================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Error: Please run as root (use sudo)"
  exit 1
fi

# Variables
NGINX_CONF_SOURCE="$(dirname "$0")/nginx.conf"
NGINX_CONF_DEST="/etc/nginx/nginx.conf"
SSL_DIR="/etc/nginx/ssl"
DOMAINS="api.e-beautything.com admin.e-beautything.com"
EMAIL="admin@e-beautything.com"

echo ""
echo "Step 1: Installing Nginx..."
apt-get update
apt-get install -y nginx

echo ""
echo "Step 2: Installing Certbot for SSL..."
apt-get install -y certbot python3-certbot-nginx

echo ""
echo "Step 3: Backing up existing Nginx configuration..."
if [ -f "$NGINX_CONF_DEST" ]; then
  cp "$NGINX_CONF_DEST" "$NGINX_CONF_DEST.backup.$(date +%Y%m%d_%H%M%S)"
fi

echo ""
echo "Step 4: Installing new Nginx configuration..."
cp "$NGINX_CONF_SOURCE" "$NGINX_CONF_DEST"

echo ""
echo "Step 5: Creating SSL directory..."
mkdir -p "$SSL_DIR"

echo ""
echo "Step 6: Testing Nginx configuration..."
nginx -t

echo ""
echo "============================================="
echo "Nginx setup completed!"
echo "============================================="
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Make sure your DNS records are set up:"
echo "   - api.e-beautything.com → Your server IP"
echo "   - admin.e-beautything.com → Your server IP"
echo ""
echo "2. Update the EMAIL variable in this script"
echo ""
echo "3. Run SSL certificate setup:"
echo "   sudo ./setup-ssl.sh"
echo ""
echo "4. Start your backend application:"
echo "   npm run start  # or use PM2/systemd"
echo ""
echo "5. Reload Nginx:"
echo "   sudo systemctl reload nginx"
echo ""

