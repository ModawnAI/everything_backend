#!/bin/bash
# =============================================
# SSL Certificate Setup Script using Let's Encrypt
# Domains: api.e-beautything.com & admin.e-beautything.com
# =============================================

set -e

echo "============================================="
echo "SSL Certificate Setup"
echo "============================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Error: Please run as root (use sudo)"
  exit 1
fi

# Variables - CHANGE THESE!
EMAIL="admin@e-beautything.com"
DOMAINS="api.e-beautything.com admin.e-beautything.com"

# Validate email
if [ "$EMAIL" = "your-email@example.com" ]; then
  echo "Error: Please update the EMAIL variable in this script!"
  exit 1
fi

echo ""
echo "Email: $EMAIL"
echo "Domains: $DOMAINS"
echo ""
read -p "Is this information correct? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted. Please edit the script and update the variables."
  exit 1
fi

echo ""
echo "Step 1: Stopping Nginx temporarily..."
systemctl stop nginx

echo ""
echo "Step 2: Obtaining SSL certificates from Let's Encrypt..."
certbot certonly --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --domains "api.e-beautything.com" \
  --non-interactive

certbot certonly --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --domains "admin.e-beautything.com" \
  --non-interactive

echo ""
echo "Step 3: Creating SSL directory and copying certificates..."
mkdir -p /etc/nginx/ssl

# Link certificates for nginx
ln -sf /etc/letsencrypt/live/api.e-beautything.com/fullchain.pem /etc/nginx/ssl/fullchain.pem
ln -sf /etc/letsencrypt/live/api.e-beautything.com/privkey.pem /etc/nginx/ssl/privkey.pem

echo ""
echo "Step 4: Setting up automatic certificate renewal..."
# Add cron job for renewal
(crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo ""
echo "Step 5: Starting Nginx..."
systemctl start nginx
systemctl enable nginx

echo ""
echo "Step 6: Verifying SSL setup..."
systemctl status nginx --no-pager

echo ""
echo "============================================="
echo "SSL Setup Complete!"
echo "============================================="
echo ""
echo "Your certificates have been installed:"
echo "- api.e-beautything.com"
echo "- admin.e-beautything.com"
echo ""
echo "Certificates will auto-renew every 12 hours."
echo ""
echo "Test your domains:"
echo "  curl https://api.e-beautything.com/health"
echo "  curl https://admin.e-beautything.com/"
echo ""

