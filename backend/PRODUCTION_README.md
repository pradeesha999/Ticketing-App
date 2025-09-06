# Production Deployment Guide

This document outlines the security measures and production deployment considerations for the Ticketing System.

## 🚨 Security Features Implemented

### 1. **Input Validation & Sanitization**
- **Express Validator**: Comprehensive input validation for all endpoints
- **Input Sanitization**: Automatic trimming and cleaning of user inputs
- **MongoDB Sanitization**: Prevents NoSQL injection attacks
- **XSS Protection**: Blocks cross-site scripting attempts
- **Parameter Pollution Prevention**: Blocks duplicate parameter attacks

### 2. **Rate Limiting**
- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP (prevents brute force)
- **Configurable**: All limits can be adjusted via environment variables

### 3. **Security Headers**
- **Helmet.js**: Comprehensive security headers
- **Content Security Policy (CSP)**: Prevents XSS and injection attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Strict-Transport-Security**: Enforces HTTPS

### 4. **Authentication & Authorization**
- **JWT Tokens**: Secure token-based authentication
- **Role-based Access Control**: Granular permissions per endpoint
- **Token Expiration**: Configurable token lifetime
- **Secure Password Requirements**: Minimum 8 chars with complexity

### 5. **Error Handling**
- **Comprehensive Error Logging**: All errors logged with context
- **No Information Leakage**: Production errors don't expose internals
- **Graceful Degradation**: System continues functioning on errors
- **Audit Trail**: Complete logging of all actions

### 6. **File Upload Security**
- **File Type Validation**: Only allowed MIME types accepted
- **Size Limits**: Configurable file size restrictions
- **Virus Scanning**: Ready for integration with antivirus services
- **Secure Storage**: Files stored outside web root

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
MONGO_URI=mongodb://username:password@host:port/database

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-here
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf

# Request Limits
REQUEST_TIMEOUT_MS=30000
MAX_REQUEST_SIZE=10mb
```

### Production Environment File

Create a `.env` file in the backend directory with the above variables. **Never commit this file to version control.**

## 🚀 Deployment Steps

### 1. **Server Preparation**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (LTS version)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install MongoDB
sudo apt install -y mongodb

# Install Nginx (for reverse proxy)
sudo apt install -y nginx
```

### 2. **Application Deployment**
```bash
# Clone repository
git clone <your-repo-url>
cd ticketing-system/backend

# Install dependencies
npm install --production

# Create environment file
cp .env.example .env
# Edit .env with production values

# Build application
npm run build

# Start with PM2
pm2 start server.js --name "ticketing-system"
pm2 save
pm2 startup
```

### 3. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
        limit_req zone=api burst=20 nodelay;
    }

    location /health {
        proxy_pass http://localhost:5000;
        access_log off;
    }
}
```

### 4. **SSL Certificate (Let's Encrypt)**
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔒 Security Hardening

### 1. **Firewall Configuration**
```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. **MongoDB Security**
```bash
# Create admin user
mongo
use admin
db.createUser({
  user: "adminUser",
  pwd: "securePassword",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Enable authentication
sudo nano /etc/mongod.conf
# Add:
security:
  authorization: enabled

# Restart MongoDB
sudo systemctl restart mongod
```

### 3. **System Security**
```bash
# Disable root login
sudo passwd -l root

# Create sudo user
sudo adduser deploy
sudo usermod -aG sudo deploy

# SSH key authentication only
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PermitRootLogin no

sudo systemctl restart sshd
```

## 📊 Monitoring & Health Checks

### Health Endpoints
- **`/health`**: Basic health status
- **`/health/detailed`**: Comprehensive system status
- **`/health/ready`**: Kubernetes readiness probe
- **`/health/live`**: Kubernetes liveness probe
- **`/health/metrics`**: Prometheus metrics

### Monitoring Integration
```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# System monitoring
htop
iotop
nethogs

# Application monitoring
pm2 monit
pm2 logs ticketing-system
```

## 🚨 Incident Response

### 1. **Security Breach Response**
```bash
# Immediate actions
pm2 stop ticketing-system
sudo systemctl stop nginx

# Investigate
pm2 logs ticketing-system --lines 1000
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check for unauthorized access
sudo last
sudo lastb
```

### 2. **Database Compromise**
```bash
# Stop application
pm2 stop ticketing-system

# Backup current state
mongodump --db ticketing-system --out /backup/$(date +%Y%m%d_%H%M%S)

# Restore from clean backup
mongorestore --db ticketing-system /backup/clean_backup/

# Restart application
pm2 start ticketing-system
```

## 📈 Performance Optimization

### 1. **Database Optimization**
```javascript
// Add indexes for frequently queried fields
db.tickets.createIndex({ "status": 1, "createdAt": -1 })
db.tickets.createIndex({ "assignedTo": 1, "status": 1 })
db.users.createIndex({ "email": 1 })
db.medicalSubmissions.createIndex({ "status": 1, "createdAt": -1 })
```

### 2. **Application Optimization**
```bash
# Enable compression
npm install compression

# Enable caching
npm install redis

# Load balancing
pm2 start server.js -i max
```

## 🔄 Backup Strategy

### 1. **Automated Backups**
```bash
#!/bin/bash
# /usr/local/bin/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mongodb"
DB_NAME="ticketing-system"

# Create backup
mongodump --db $DB_NAME --out $BACKUP_DIR/$DATE

# Compress backup
tar -czf $BACKUP_DIR/$DATE.tar.gz $BACKUP_DIR/$DATE

# Remove uncompressed backup
rm -rf $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

# Log backup
echo "Backup completed: $DATE" >> /var/log/backup.log
```

### 2. **Backup Cron Job**
```bash
# Add to crontab
sudo crontab -e

# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh
```

## 🧪 Testing Security

### 1. **Security Testing Tools**
```bash
# Install security testing tools
npm install -g npm-audit
npm install -g snyk

# Run security audits
npm audit
snyk test
```

### 2. **Penetration Testing**
```bash
# Install OWASP ZAP
sudo apt install -y zaproxy

# Run security scan
zaproxy -daemon -port 8080 -host 0.0.0.0
```

## 📋 Maintenance Checklist

### Daily
- [ ] Check application logs for errors
- [ ] Monitor system resources
- [ ] Verify backup completion

### Weekly
- [ ] Review security logs
- [ ] Update system packages
- [ ] Check SSL certificate expiration
- [ ] Review rate limiting effectiveness

### Monthly
- [ ] Security audit review
- [ ] Performance metrics analysis
- [ ] Backup restoration test
- [ ] Update dependencies

### Quarterly
- [ ] Full security assessment
- [ ] Disaster recovery drill
- [ ] Performance optimization review
- [ ] Compliance audit

## 🆘 Emergency Contacts

- **System Administrator**: [Contact Info]
- **Security Team**: [Contact Info]
- **Database Administrator**: [Contact Info]
- **Hosting Provider**: [Contact Info]

## 📚 Additional Resources

- [OWASP Security Guidelines](https://owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practices-security.html)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update security measures based on new threats and best practices.
