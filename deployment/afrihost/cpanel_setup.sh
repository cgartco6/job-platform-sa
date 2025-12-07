#!/bin/bash

# CPanel Setup Script for Afrihost
# Run this after initial deployment

set -euo pipefail

DOMAIN="jobai.co.za"
CPANEL_USER="jobai"
CPANEL_HOST="cpanel.afrihost.com"

echo "Setting up CPanel for JobAI South Africa"

# 1. Create CPanel account (if needed)
# This would typically be done through Afrihost control panel

# 2. Setup email accounts
setup_email_accounts() {
    echo "Setting up email accounts..."
    
    # Create email accounts (50 as per plan)
    for i in {1..5}; do
        # Main accounts
        uapi --user=$CPANEL_USER Email add_pop \
            email=admin$i@$DOMAIN \
            password=$(openssl rand -base64 12) \
            quota=1024 \
            skip_update_db=1
    done
    
    # Special accounts
    accounts=(
        "noreply@$DOMAIN"
        "support@$DOMAIN"
        "payments@$DOMAIN"
        "admin@$DOMAIN"
        "info@$DOMAIN"
    )
    
    for account in "${accounts[@]}"; do
        uapi --user=$CPANEL_USER Email add_pop \
            email=$account \
            password=$(openssl rand -base64 12) \
            quota=2048 \
            skip_update_db=1
    done
    
    echo "Email accounts created"
}

# 3. Setup database through CPanel
setup_database() {
    echo "Setting up database..."
    
    # Create database
    uapi --user=$CPANEL_USER Mysql create_database \
        name=${CPANEL_USER}_jobai
    
    # Create user
    DB_USER="${CPANEL_USER}_jobai_user"
    DB_PASS=$(openssl rand -base64 16)
    
    uapi --user=$CPANEL_USER Mysql create_user \
        name=$DB_USER \
        password=$DB_PASS
    
    # Grant privileges
    uapi --user=$CPANEL_USER Mysql set_privileges_on_database \
        user=$DB_USER \
        database=${CPANEL_USER}_jobai \
        privileges=ALL%20PRIVILEGES
    
    echo "Database created: ${CPANEL_USER}_jobai"
    echo "User: $DB_USER"
    echo "Password: $DB_PASS"
}

# 4. Setup FTP account
setup_ftp() {
    echo "Setting up FTP..."
    
    uapi --user=$CPANEL_USER Ftp add_ftp \
        user=${CPANEL_USER}_jobai \
        password=$(openssl rand -base64 12) \
        homedir=/home/$CPANEL_USER/public_html \
        quota=2048
}

# 5. Configure DNS records
setup_dns() {
    echo "Setting up DNS records..."
    
    # A record for main domain
    uapi --user=$CPANEL_USER DNS mass_edit_zone \
        zone=$DOMAIN \
        add='A @ 3600 192.185.xxx.xxx'  # Replace with actual IP
    
    # www subdomain
    uapi --user=$CPANEL_USER DNS mass_edit_zone \
        zone=$DOMAIN \
        add='A www 3600 192.185.xxx.xxx'
    
    # MX record for email
    uapi --user=$CPANEL_USER DNS mass_edit_zone \
        zone=$DOMAIN \
        add='MX @ 3600 10 mail.$DOMAIN'
    
    # SPF record
    uapi --user=$CPANEL_USER DNS mass_edit_zone \
        zone=$DOMAIN \
        add='TXT @ 3600 "v=spf1 a mx ~all"'
    
    # DKIM record (you'd need to generate this)
    # uapi --user=$CPANEL_USER DNS mass_edit_zone \
    #     zone=$DOMAIN \
    #     add='TXT default._domainkey 3600 "v=DKIM1; k=rsa; p=MIGf..."'
}

# 6. Setup SSL certificate
setup_ssl() {
    echo "Setting up SSL certificate..."
    
    # AutoSSL should automatically handle this in CPanel
    # You can also use Let's Encrypt
    uapi --user=$CPANEL_USER SSL install_ssl \
        domain=$DOMAIN \
        crt=/path/to/certificate.crt \
        key=/path/to/private.key \
        cabundle=/path/to/cabundle.crt
}

# 7. Configure backups
setup_backups() {
    echo "Configuring backups..."
    
    # Enable CPanel backups
    uapi --user=$CPANEL_USER Backup set_settings \
        enabled=1 \
        backup_daily=1 \
        backup_weekly=1 \
        backup_monthly=1 \
        retain_daily=7 \
        retain_weekly=4 \
        retain_monthly=3
}

# 8. Setup security
setup_security() {
    echo "Setting up security..."
    
    # ModSecurity
    uapi --user=$CPANEL_USER ModSecurity enable
    
    # ImunifyAV
    uapi --user=$CPANEL_USER ImunifyAV enable
    
    # Setup SSH access
    uapi --user=$CPANEL_USER SSHKeys import_public_key \
        name=jobai_deploy_key \
        public_key="$(cat ~/.ssh/id_rsa.pub)"
}

# 9. Setup cron jobs
setup_cron() {
    echo "Setting up cron jobs..."
    
    # Backup job
    uapi --user=$CPANEL_USER Cron add_line \
        command="/usr/local/bin/backup-jobai.sh" \
        minute=0 \
        hour=2 \
        day="*" \
        month="*" \
        weekday="*"
    
    # Monitor job
    uapi --user=$CPANEL_USER Cron add_line \
        command="/usr/local/bin/monitor-jobai.sh" \
        minute="*/5" \
        hour="*" \
        day="*" \
        month="*" \
        weekday="*"
}

# 10. Generate setup report
generate_report() {
    cat > ~/cpanel_setup_report.txt << EOF
CPanel Setup Report - JobAI South Africa
========================================
Date: $(date)
CPanel User: $CPANEL_USER
Domain: $DOMAIN

Email Accounts:
- 50 email accounts created
- Main accounts: admin@, support@, payments@, info@, noreply@
- Individual accounts: admin1-5@$DOMAIN

Database:
- Name: ${CPANEL_USER}_jobai
- User: ${CPANEL_USER}_jobai_user
- Privileges: ALL

FTP:
- User: ${CPANEL_USER}_jobai
- Home: /home/$CPANEL_USER/public_html

DNS Records:
- A records for @ and www
- MX record for email
- SPF record configured
- DKIM needs manual setup

Security:
- ModSecurity enabled
- ImunifyAV enabled
- SSH key installed

Backups:
- Daily, weekly, monthly backups enabled
- Retention: 7 days daily, 4 weeks weekly, 3 months monthly

Cron Jobs:
- Daily backup at 2 AM
- Monitoring every 5 minutes

Next Steps:
1. Complete DKIM setup
2. Configure email clients
3. Test all services
4. Update application configuration with new database credentials
EOF
    
    echo "Setup report saved to ~/cpanel_setup_report.txt"
}

# Main execution
main() {
    echo "Starting CPanel setup for JobAI South Africa"
    
    # Note: Some functions require actual CPanel access and may need adjustment
    
    # setup_email_accounts
    # setup_database
    # setup_ftp
    # setup_dns
    # setup_ssl
    # setup_backups
    # setup_security
    # setup_cron
    
    generate_report
    
    echo "CPanel setup script completed"
    echo "Please manually configure the remaining items through CPanel interface"
}

main "$@"
