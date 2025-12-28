# ✅ Nginx Setup Complete for 에뷰리띵 Backend

## 🎉 Setup Summary

Successfully configured nginx reverse proxy with SSL/TLS for your backend API and admin panel.

---

## 🌐 Domain Configuration

| Domain | Purpose | Status |
|--------|---------|--------|
| **api.e-beautything.com** | Backend API | ✅ Working |
| **admin.e-beautything.com** | Admin Panel | ✅ Working |

---

## 🔒 SSL Certificates

- **Provider**: Let's Encrypt
- **Status**: Active
- **Expiry**: January 24, 2026
- **Auto-Renewal**: Enabled (every 12 hours)

### Certificate Locations

- API Domain:
  - Certificate: `/etc/letsencrypt/live/api.e-beautything.com/fullchain.pem`
  - Private Key: `/etc/letsencrypt/live/api.e-beautything.com/privkey.pem`

- Admin Domain:
  - Certificate: `/etc/letsencrypt/live/admin.e-beautything.com/fullchain.pem`
  - Private Key: `/etc/letsencrypt/live/admin.e-beautything.com/privkey.pem`

---

## ✅ Verified Working Features

1. **HTTPS Access**
   - ✅ https://api.e-beautything.com/health
   - ✅ https://admin.e-beautything.com/

2. **HTTP → HTTPS Redirect**
   - ✅ All HTTP traffic automatically redirected to HTTPS

3. **Reverse Proxy**
   - ✅ Nginx forwards requests to backend on localhost:3001

4. **Security Features**
   - ✅ TLS 1.2 and TLS 1.3 enabled
   - ✅ Strong cipher suites
   - ✅ Security headers (HSTS, X-Frame-Options, etc.)
   - ✅ Rate limiting enabled
   - ✅ Connection limiting enabled

5. **Performance Optimizations**
   - ✅ HTTP/2 enabled
   - ✅ Gzip compression
   - ✅ Keep-alive connections
   - ✅ Upstream connection pooling

---

## 🔧 Configuration Files

- Main Config: `/etc/nginx/nginx.conf`
- Source Config: `/home/bitnami/everything_backend/nginx/nginx.conf`
- HTTP-Only Config (backup): `/home/bitnami/everything_backend/nginx/nginx-http-only.conf`

---

## 📊 Service Status

```bash
# Check Nginx status
sudo systemctl status nginx

# Check backend status
curl http://localhost:3001/health

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Common Operations

### Reload Nginx (no downtime)
```bash
sudo systemctl reload nginx
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

### Test Configuration
```bash
sudo nginx -t
```

### Check SSL Certificates
```bash
sudo certbot certificates
```

### Manual Certificate Renewal
```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## 🚫 What Was Disabled

- **Apache/httpd**: Stopped and will no longer auto-start
  - If you need to re-enable: `sudo /opt/bitnami/ctlscript.sh start apache`
  - Port 80 and 443 are now used by Nginx

---

## 🔐 Security Configuration

### Rate Limiting
- **API Endpoints**: 10 requests/second (burst: 20)
- **Auth Endpoints**: 5 requests/minute (burst: 5)
- **Admin Panel**: 10 requests/second (burst: 10)

### Connection Limits
- **Max Concurrent Connections**: 10 per IP

### Security Headers
- X-Frame-Options: SAMEORIGIN (API), DENY (Admin)
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
- Content-Security-Policy: default-src 'self' (Admin only)

---

## 🧪 Testing Commands

### Test API Health
```bash
curl https://api.e-beautything.com/health
```

Expected Response:
```json
{"status":"ok","message":"에뷰리띵 백엔드 서버가 정상적으로 실행 중입니다.","timestamp":"2025-10-26T06:54:34.404Z","version":"1.0.0"}
```

### Test Admin Panel
```bash
curl -I https://admin.e-beautything.com/
```

Expected: HTTP/2 200 OK

### Test HTTP Redirect
```bash
curl -I http://api.e-beautything.com/health
```

Expected: HTTP/1.1 301 → https://api.e-beautything.com/health

### Test SSL Certificate
```bash
echo | openssl s_client -connect api.e-beautything.com:443 -servername api.e-beautything.com 2>/dev/null | openssl x509 -noout -dates
```

---

## 📝 Auto-Renewal Configuration

Certificates automatically renew via cron job:
```bash
# Check cron job
sudo crontab -l | grep certbot

# Output:
0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'
```

This runs at midnight and noon every day, checking for certificates that need renewal.

---

## 🐛 Troubleshooting

### If Nginx Won't Start
```bash
# Check for syntax errors
sudo nginx -t

# Check what's using port 80/443
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# View error logs
sudo journalctl -xeu nginx.service
```

### If Backend Returns 502 Bad Gateway
```bash
# Check if backend is running
curl http://localhost:3001/health

# If not, start the backend
cd /home/bitnami/everything_backend
npm run start
```

### If SSL Errors Occur
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 📚 Additional Resources

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

---

## 🎯 Next Steps

1. **Monitor Logs**: Keep an eye on access and error logs
   ```bash
   sudo tail -f /var/log/nginx/access.log
   ```

2. **Set Up Monitoring**: Consider adding monitoring tools like:
   - Prometheus + Grafana
   - New Relic
   - Datadog

3. **Backup Configuration**: Regularly backup your nginx config
   ```bash
   sudo cp /etc/nginx/nginx.conf /home/bitnami/everything_backend/nginx/nginx.conf.backup
   ```

4. **Performance Testing**: Run load tests to ensure proper performance
   ```bash
   # Using Apache Bench
   ab -n 1000 -c 10 https://api.e-beautything.com/health
   ```

5. **Update Backend**: Make sure your backend app knows about the domains:
   - Update CORS settings to allow `https://api.e-beautything.com`
   - Update any hardcoded URLs in your application

---

## ✅ Setup Completed On

- **Date**: October 26, 2025
- **Time**: 06:54 UTC
- **Server**: ip-172-26-14-90 (43.203.38.131)
- **System**: Bitnami Debian

---

**🎊 Congratulations! Your nginx setup is complete and fully functional! 🎊**





