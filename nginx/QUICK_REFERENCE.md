# 🚀 Nginx Quick Reference Card

## 📋 Your Domains

| Domain | URL |
|--------|-----|
| API | https://api.e-beautything.com |
| Admin | https://admin.e-beautything.com |

## ⚡ Essential Commands

### Nginx Control
```bash
# Reload config (no downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# Test config
sudo nginx -t

# View full config
sudo nginx -T
```

### SSL Certificates
```bash
# Check certificates
sudo certbot certificates

# Renew certificates
sudo certbot renew
sudo systemctl reload nginx

# Force renewal (testing)
sudo certbot renew --force-renewal
```

### Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log

# Last 50 errors
sudo tail -50 /var/log/nginx/error.log
```

### Backend
```bash
# Check backend
curl http://localhost:3001/health

# Start backend
cd /home/bitnami/everything_backend
npm run start

# Use PM2 (recommended)
pm2 start npm --name "backend" -- start
pm2 save
pm2 startup
```

## 🔍 Quick Tests

```bash
# Test API
curl https://api.e-beautything.com/health

# Test Admin
curl -I https://admin.e-beautything.com/

# Test redirect
curl -I http://api.e-beautything.com/health
```

## 📊 Certificate Info

- **Provider**: Let's Encrypt
- **Expiry**: January 24, 2026 (89 days)
- **Auto-Renewal**: Every 12 hours (cron)

## 🆘 Emergency Troubleshooting

### Nginx won't start?
```bash
sudo nginx -t                    # Check syntax
sudo systemctl status nginx      # Check status
sudo journalctl -xeu nginx       # Check logs
```

### 502 Bad Gateway?
```bash
curl http://localhost:3001/health  # Check backend
sudo systemctl restart nginx       # Restart nginx
```

### SSL errors?
```bash
sudo certbot certificates          # Check certs
sudo certbot renew --force-renewal # Renew
sudo systemctl reload nginx        # Reload
```

## 📁 Important Files

- Config: `/etc/nginx/nginx.conf`
- Source: `/home/bitnami/everything_backend/nginx/nginx.conf`
- Certs: `/etc/letsencrypt/live/`
- Logs: `/var/log/nginx/`

## 🔒 Enabled Security

✅ HTTPS (TLS 1.2/1.3)
✅ Rate Limiting
✅ HSTS Headers
✅ HTTP → HTTPS Redirect
✅ Connection Limits
✅ Auto Certificate Renewal

---

**Setup Date**: October 26, 2025
**Full Documentation**: [SETUP_COMPLETE.md](./SETUP_COMPLETE.md)





