# Nginx Deployment Guide for 에뷰리띵 Backend

This guide covers the complete setup of nginx reverse proxy for your backend API and admin panel.

## 🌐 Domain Configuration

- **API Backend**: `api.e-beautything.com`
- **Admin Panel**: `admin.e-beautything.com`

## 📋 Prerequisites

1. **Server Requirements**
   - Ubuntu 20.04+ or similar Linux distribution
   - Root/sudo access
   - Backend application running on port **3001**

2. **DNS Configuration**
   - Add A records pointing to your server IP:
     ```
     api.e-beautything.com      →  YOUR_SERVER_IP
     admin.e-beautything.com    →  YOUR_SERVER_IP
     ```
   - Wait for DNS propagation (can take up to 48 hours, usually faster)

3. **Firewall Configuration**
   - Allow ports 80 (HTTP) and 443 (HTTPS):
     ```bash
     sudo ufw allow 80/tcp
     sudo ufw allow 443/tcp
     sudo ufw allow 3001/tcp  # Backend application
     ```

## 🚀 Quick Start

### 1. Prepare Scripts

Make the setup scripts executable:
```bash
cd /home/bitnami/everything_backend/nginx
chmod +x setup-nginx.sh setup-ssl.sh
```

### 2. Update Email Address

Edit both scripts and update the `EMAIL` variable:
```bash
nano setup-ssl.sh
# Change: EMAIL="your-email@example.com"
# To: EMAIL="admin@e-beautything.com"  # Your actual email
```

### 3. Verify DNS

Check that DNS is properly configured:
```bash
nslookup api.e-beautything.com
nslookup admin.e-beautything.com
```

Both should resolve to your server's IP address.

### 4. Run Setup Scripts

Install and configure Nginx:
```bash
sudo ./setup-nginx.sh
```

Setup SSL certificates (only run after DNS is properly configured):
```bash
sudo ./setup-ssl.sh
```

### 5. Start Backend Application

Make sure your backend is running on port 3001:
```bash
cd /home/bitnami/everything_backend
npm run build
npm run start
```

Or use PM2 for production:
```bash
npm install -g pm2
pm2 start npm --name "ebeautything-backend" -- start
pm2 save
pm2 startup
```

## 🔍 Manual Setup (Alternative)

If you prefer manual setup or the scripts don't work:

### 1. Install Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 2. Install Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 3. Copy Nginx Configuration

```bash
sudo cp /home/bitnami/everything_backend/nginx/nginx.conf /etc/nginx/nginx.conf
```

### 4. Test Configuration

```bash
sudo nginx -t
```

### 5. Obtain SSL Certificates

For API domain:
```bash
sudo certbot certonly --standalone \
  --email admin@e-beautything.com \
  --agree-tos \
  --domains api.e-beautything.com
```

For Admin domain:
```bash
sudo certbot certonly --standalone \
  --email admin@e-beautything.com \
  --agree-tos \
  --domains admin.e-beautything.com
```

### 6. Link SSL Certificates

```bash
sudo mkdir -p /etc/nginx/ssl
sudo ln -sf /etc/letsencrypt/live/api.e-beautything.com/fullchain.pem /etc/nginx/ssl/fullchain.pem
sudo ln -sf /etc/letsencrypt/live/api.e-beautything.com/privkey.pem /etc/nginx/ssl/privkey.pem
```

### 7. Reload Nginx

```bash
sudo systemctl reload nginx
```

## ✅ Verification

### Check Nginx Status
```bash
sudo systemctl status nginx
```

### Test API Endpoint
```bash
curl https://api.e-beautything.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Test Admin Panel
```bash
curl -I https://admin.e-beautything.com/
```

Should return HTTP 200 OK.

### Check SSL Certificate
```bash
curl -vI https://api.e-beautything.com 2>&1 | grep -i 'SSL certificate'
```

### Monitor Nginx Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

## 🔒 Security Features

The nginx configuration includes:

- **SSL/TLS**: TLS 1.2 and 1.3 with modern cipher suites
- **Security Headers**: 
  - X-Frame-Options
  - X-Content-Type-Options
  - X-XSS-Protection
  - Strict-Transport-Security (HSTS)
- **Rate Limiting**: 
  - API: 10 requests/second
  - Auth endpoints: 5 requests/minute
- **Connection Limiting**: Max 10 concurrent connections per IP
- **Gzip Compression**: Enabled for text-based content

## 📊 Performance Optimizations

- **HTTP/2**: Enabled for better performance
- **Keep-Alive**: Persistent connections
- **Gzip Compression**: Reduces bandwidth usage
- **Upstream Keep-Alive**: Connection pooling to backend
- **Static File Caching**: 1-year cache for images and assets

## 🔄 SSL Certificate Renewal

Certificates are automatically renewed by cron job:
```bash
# View cron job
crontab -l

# Manually renew certificates
sudo certbot renew --dry-run

# Force renewal (if needed)
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

## 🐛 Troubleshooting

### Issue: "Connection refused"
```bash
# Check if backend is running
sudo netstat -tlnp | grep 3001

# Check backend logs
cd /home/bitnami/everything_backend
npm run start  # Check for errors
```

### Issue: "502 Bad Gateway"
```bash
# Check nginx error logs
sudo tail -50 /var/log/nginx/error.log

# Verify backend is accessible
curl http://localhost:3001/health

# Check nginx upstream configuration
sudo nginx -T | grep backend
```

### Issue: SSL Certificate Errors
```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificates
sudo certbot renew
sudo systemctl reload nginx
```

### Issue: DNS Not Resolving
```bash
# Check DNS propagation
nslookup api.e-beautything.com 8.8.8.8
nslookup admin.e-beautything.com 8.8.8.8

# Wait for DNS to propagate (up to 48 hours)
```

### Issue: Port 80/443 Already in Use
```bash
# Check what's using the ports
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Stop conflicting service
sudo systemctl stop apache2  # if Apache is running
```

## 📝 Common Commands

```bash
# Start/Stop/Restart Nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx  # Graceful reload without dropping connections

# Test configuration
sudo nginx -t

# View full configuration
sudo nginx -T

# Check Nginx version
nginx -v

# Enable Nginx on boot
sudo systemctl enable nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Updating Configuration

When you need to update nginx configuration:

```bash
# 1. Edit the configuration
cd /home/bitnami/everything_backend/nginx
nano nginx.conf

# 2. Test the new configuration
sudo nginx -t

# 3. If test passes, copy to nginx directory
sudo cp nginx.conf /etc/nginx/nginx.conf

# 4. Reload nginx (graceful, no downtime)
sudo systemctl reload nginx
```

## 📈 Monitoring

### Real-time Access Log
```bash
sudo tail -f /var/log/nginx/access.log
```

### Check Response Times
```bash
sudo tail -f /var/log/nginx/access.log | grep -oP 'rt=\K[0-9.]+'
```

### Count Requests by Status Code
```bash
sudo cat /var/log/nginx/access.log | cut -d '"' -f3 | cut -d ' ' -f2 | sort | uniq -c | sort -rn
```

### Top 10 IP Addresses
```bash
sudo cat /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
```

## 🆘 Support

If you encounter issues:

1. Check logs: `/var/log/nginx/error.log`
2. Verify backend is running: `curl http://localhost:3001/health`
3. Test DNS: `nslookup api.e-beautything.com`
4. Check SSL certificates: `sudo certbot certificates`
5. Review nginx configuration: `sudo nginx -T`

For additional help, refer to:
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)





