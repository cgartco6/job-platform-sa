#!/bin/bash

# JobAI South Africa - Afrihost Deployment Script
# For: 2GB space, 50 emails, SQL database

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Configuration
DOMAIN="jobai.co.za"
EMAIL_HOSTING="true"
EMAIL_COUNT=50
DATABASE_TYPE="mysql"
DATABASE_NAME="jobai_db"
DATABASE_USER="jobai_user"
BACKUP_DIR="/home/backups/jobai"
DEPLOYMENT_DIR="/home/jobai"
LOG_FILE="/var/log/jobai_deployment.log"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

# Initialize log file
exec > >(tee -a $LOG_FILE) 2>&1

log "Starting JobAI South Africa deployment to Afrihost"

# Step 1: System Update
log "Step 1: Updating system packages"
apt-get update -y
apt-get upgrade -y

# Step 2: Install Required Packages
log "Step 2: Installing required packages"
apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    nginx \
    certbot \
    python3-certbot-nginx \
    mysql-server \
    mysql-client \
    nodejs \
    npm \
    python3 \
    python3-pip \
    python3-venv \
    redis-server \
    supervisor \
    ufw \
    fail2ban \
    htop \
    net-tools

# Step 3: Configure Firewall
log "Step 3: Configuring firewall"
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 5000/tcp
ufw reload

# Step 4: Setup Database
log "Step 4: Setting up MySQL database"

# Secure MySQL installation
mysql_secure_installation <<EOF
n
y
y
y
y
EOF

# Create database and user
mysql -e "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '$DATABASE_USER'@'localhost' IDENTIFIED BY '$(openssl rand -base64 32)';"
mysql -e "GRANT ALL PRIVILEGES ON $DATABASE_NAME.* TO '$DATABASE_USER'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

log "Database created: $DATABASE_NAME"

# Step 5: Create Deployment Directory
log "Step 5: Creating deployment directory"
mkdir -p $DEPLOYMENT_DIR
mkdir -p $BACKUP_DIR
mkdir -p $DEPLOYMENT_DIR/logs
mkdir -p $DEPLOYMENT_DIR/uploads
mkdir -p $DEPLOYMENT_DIR/backups

chown -R www-data:www-data $DEPLOYMENT_DIR
chmod -R 755 $DEPLOYMENT_DIR

# Step 6: Clone or Copy Application
log "Step 6: Setting up application code"

if [ -d "$DEPLOYMENT_DIR/.git" ]; then
    cd $DEPLOYMENT_DIR
    git pull origin main
else
    # If you have a git repository
    # git clone https://github.com/yourusername/job-platform-sa.git $DEPLOYMENT_DIR
    
    # For local copy (adjust path as needed)
    cp -r /path/to/your/local/copy/* $DEPLOYMENT_DIR/ || warn "Could not copy application files"
fi

# Step 7: Install Node.js Dependencies
log "Step 7: Installing Node.js dependencies"
cd $DEPLOYMENT_DIR/backend
npm install --production

cd $DEPLOYMENT_DIR/frontend
npm install --production
npm run build

# Step 8: Install Python Dependencies
log "Step 8: Installing Python dependencies"
cd $DEPLOYMENT_DIR/ai_services
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Step 9: Configure Environment Variables
log "Step 9: Configuring environment variables"

cat > $DEPLOYMENT_DIR/.env << EOF
# Application
NODE_ENV=production
PORT=5000
BASE_URL=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN

# Database
MYSQL_HOST=localhost
MYSQL_DATABASE=$DATABASE_NAME
MYSQL_USER=$DATABASE_USER
MYSQL_PASSWORD=$(openssl rand -base64 32)

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=$(openssl rand -base64 64)
JWT_EXPIRES_IN=7d

# Payment Gateways
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase

# AI Services
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Email
SMTP_HOST=mail.$DOMAIN
SMTP_PORT=587
SMTP_USER=noreply@$DOMAIN
SMTP_PASSWORD=$(openssl rand -base64 16)
EMAIL_FROM=noreply@$DOMAIN

# Storage
UPLOAD_DIR=$DEPLOYMENT_DIR/uploads
MAX_FILE_SIZE=50MB

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn
EOF

chmod 600 $DEPLOYMENT_DIR/.env
chown www-data:www-data $DEPLOYMENT_DIR/.env

# Step 10: Configure Nginx
log "Step 10: Configuring Nginx"

cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL Configuration (will be set up by Certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend
    location / {
        root $DEPLOYMENT_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    # Static files
    location /uploads/ {
        alias $DEPLOYMENT_DIR/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
    
    # Block sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ /(\.env|\.git|\.htaccess|\.htpasswd) {
        deny all;
    }
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Step 11: Setup SSL with Let's Encrypt
log "Step 11: Setting up SSL certificate"

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
else
    certbot renew --quiet
fi

# Step 12: Configure Supervisor
log "Step 12: Configuring Supervisor for process management"

# Backend service
cat > /etc/supervisor/conf.d/jobai-backend.conf << EOF
[program:jobai-backend]
command=/usr/bin/node $DEPLOYMENT_DIR/backend/src/app.js
directory=$DEPLOYMENT_DIR/backend
user=www-data
autostart=true
autorestart=true
startretries=3
stderr_logfile=/var/log/jobai-backend.err.log
stdout_logfile=/var/log/jobai-backend.out.log
environment=NODE_ENV="production",PATH="/usr/bin:/usr/local/bin"
EOF

# Frontend service (if needed)
cat > /etc/supervisor/conf.d/jobai-frontend.conf << EOF
[program:jobai-frontend]
command=/usr/bin/npm start
directory=$DEPLOYMENT_DIR/frontend
user=www-data
autostart=true
autorestart=true
startretries=3
stderr_logfile=/var/log/jobai-frontend.err.log
stdout_logfile=/var/log/jobai-frontend.out.log
environment=NODE_ENV="production"
EOF

# AI Services
cat > /etc/supervisor/conf.d/jobai-ai.conf << EOF
[program:jobai-ai]
command=$DEPLOYMENT_DIR/ai_services/venv/bin/python $DEPLOYMENT_DIR/ai_services/main.py
directory=$DEPLOYMENT_DIR/ai_services
user=www-data
autostart=true
autorestart=true
startretries=3
stderr_logfile=/var/log/jobai-ai.err.log
stdout_logfile=/var/log/jobai-ai.out.log
environment=PATH="$DEPLOYMENT_DIR/ai_services/venv/bin:/usr/bin"
EOF

# Job Scraper
cat > /etc/supervisor/conf.d/jobai-scraper.conf << EOF
[program:jobai-scraper]
command=$DEPLOYMENT_DIR/ai_services/venv/bin/python $DEPLOYMENT_DIR/ai_services/job_scraper/main.py
directory=$DEPLOYMENT_DIR/ai_services/job_scraper
user=www-data
autostart=true
autorestart=true
startretries=3
stderr_logfile=/var/log/jobai-scraper.err.log
stdout_logfile=/var/log/jobai-scraper.out.log
environment=PATH="$DEPLOYMENT_DIR/ai_services/venv/bin:/usr/bin"
EOF

# Reload supervisor
supervisorctl reread
supervisorctl update

# Step 13: Configure Email (Postfix/Dovecot)
if [ "$EMAIL_HOSTING" = "true" ]; then
    log "Step 13: Configuring email hosting for $EMAIL_COUNT emails"
    
    apt-get install -y postfix dovecot-core dovecot-imapd dovecot-pop3d
    
    # Basic Postfix configuration
    postconf -e "myhostname = mail.$DOMAIN"
    postconf -e "mydestination = $DOMAIN, localhost.localdomain, localhost"
    postconf -e "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"
    postconf -e "home_mailbox = Maildir/"
    
    # Restart Postfix
    systemctl restart postfix
    systemctl enable postfix
    
    log "Email hosting configured. Create email accounts manually in cPanel or via script."
fi

# Step 14: Setup Backup System
log "Step 14: Setting up backup system"

cat > /usr/local/bin/backup-jobai.sh << EOF
#!/bin/bash
BACKUP_DIR="$BACKUP_DIR"
DEPLOYMENT_DIR="$DEPLOYMENT_DIR"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="jobai_backup_\$DATE.tar.gz"

# Create backup
tar -czf "\$BACKUP_DIR/\$BACKUP_FILE" \
    --exclude="node_modules" \
    --exclude="venv" \
    --exclude=".git" \
    "\$DEPLOYMENT_DIR"

# Backup database
mysqldump -u root \$DATABASE_NAME | gzip > "\$BACKUP_DIR/jobai_db_\$DATE.sql.gz"

# Keep only last 7 days of backups
find "\$BACKUP_DIR" -name "jobai_backup_*" -mtime +7 -delete
find "\$BACKUP_DIR" -name "jobai_db_*" -mtime +7 -delete

# Sync to remote backup (optional)
# rsync -avz "\$BACKUP_DIR/" "user@backup-server:/path/to/backups/"
EOF

chmod +x /usr/local/bin/backup-jobai.sh

# Add to crontab for daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-jobai.sh") | crontab -

# Step 15: Setup Monitoring
log "Step 15: Setting up monitoring"

apt-get install -y prometheus-node-exporter

cat > /usr/local/bin/monitor-jobai.sh << EOF
#!/bin/bash

# Check if services are running
services=("nginx" "mysql" "redis" "supervisor")

for service in "\${services[@]}"; do
    if ! systemctl is-active --quiet \$service; then
        echo "Service \$service is down. Attempting to restart..."
        systemctl restart \$service
        
        # Send alert (you can integrate with email or monitoring service)
        echo "Service \$service was restarted at \$(date)" >> /var/log/jobai-monitor.log
    fi
done

# Check disk space
DISK_USAGE=\$(df -h / | awk 'NR==2 {print \$5}' | sed 's/%//')
if [ \$DISK_USAGE -gt 90 ]; then
    echo "Warning: Disk usage is at \$DISK_USAGE%" >> /var/log/jobai-monitor.log
fi

# Check memory
MEM_USAGE=\$(free | awk '/Mem:/ {printf("%.0f"), \$3/\$2 * 100}')
if [ \$MEM_USAGE -gt 85 ]; then
    echo "Warning: Memory usage is at \$MEM_USAGE%" >> /var/log/jobai-monitor.log
fi
EOF

chmod +x /usr/local/bin/monitor-jobai.sh

# Add to crontab to run every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-jobai.sh") | crontab -

# Step 16: Initialize Database
log "Step 16: Initializing database"

cd $DEPLOYMENT_DIR/backend
node scripts/migrate.js
node scripts/seed.js

# Step 17: Start Services
log "Step 17: Starting all services"

systemctl restart nginx
systemctl restart mysql
systemctl restart redis
systemctl restart supervisor

supervisorctl start all

# Step 18: Final Checks
log "Step 18: Running final checks"

# Check if services are running
sleep 10

check_service() {
    if systemctl is-active --quiet $1; then
        log "✓ $1 is running"
    else
        error "✗ $1 failed to start"
    fi
}

check_service nginx
check_service mysql
check_service redis
check_service supervisor

# Check if application is accessible
if curl -s -f "http://localhost:5000/health" > /dev/null; then
    log "✓ Backend API is accessible"
else
    warn "Backend API is not accessible"
fi

# Generate deployment summary
cat > $DEPLOYMENT_DIR/deployment_summary.txt << EOF
JobAI South Africa Deployment Summary
====================================
Date: $(date)
Domain: $DOMAIN
Deployment Directory: $DEPLOYMENT_DIR
Backup Directory: $BACKUP_DIR

Database:
  Name: $DATABASE_NAME
  User: $DATABASE_USER

Services:
  - Nginx (Ports: 80, 443)
  - MySQL (Port: 3306)
  - Redis (Port: 6379)
  - Node.js Backend (Port: 5000)
  - React Frontend (Port: 3000)

Email Hosting: $([ "$EMAIL_HOSTING" = "true" ] && echo "Enabled ($EMAIL_COUNT emails)" || echo "Disabled")

Backup Schedule: Daily at 2 AM
Monitoring: Every 5 minutes

Next Steps:
1. Update DNS records for $DOMAIN
2. Configure payment gateway credentials
3. Set up AI service API keys
4. Configure email accounts
5. Test the application thoroughly

Access URLs:
- Main Site: https://$DOMAIN
- API: https://$DOMAIN/api
- Admin: https://$DOMAIN/admin

Troubleshooting:
- Check logs: /var/log/jobai-*.log
- Supervisor status: supervisorctl status
- Service status: systemctl status <service>
EOF

log "Deployment completed successfully!"
log "Deployment summary saved to: $DEPLOYMENT_DIR/deployment_summary.txt"
log ""
log "Important next steps:"
log "1. Update the .env file with actual API keys"
log "2. Configure DNS settings for $DOMAIN"
log "3. Test the application thoroughly"
log ""
log "For support, check logs in /var/log/jobai-*.log"
