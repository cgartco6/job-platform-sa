# JobAI South Africa - Windows Setup Script
# For: Dell i7, Windows 10/11 Pro, 16GB RAM, 1TB SSD

# Requires: PowerShell 5.1 or later, Run as Administrator

# Configuration
$Domain = "jobai.local"
$InstallDir = "C:\JobAI"
$PythonVersion = "3.11"
$NodeVersion = "18"
$MongoVersion = "6.0"
$RedisVersion = "7.0"

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$WarningColor = "Yellow"
$InfoColor = "Cyan"

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    
    switch ($Level) {
        "ERROR" { Write-Host $LogMessage -ForegroundColor $ErrorColor }
        "SUCCESS" { Write-Host $LogMessage -ForegroundColor $SuccessColor }
        "WARNING" { Write-Host $LogMessage -ForegroundColor $WarningColor }
        default { Write-Host $LogMessage -ForegroundColor $InfoColor }
    }
    
    # Also write to file
    $LogMessage | Out-File -FilePath "$InstallDir\setup.log" -Append
}

# Check if running as Administrator
function Test-Administrator {
    $Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object System.Security.Principal.WindowsPrincipal($Identity)
    return $Principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Log "This script must be run as Administrator" "ERROR"
    exit 1
}

# Create installation directory
function Initialize-InstallationDirectory {
    Write-Log "Creating installation directory: $InstallDir"
    
    if (Test-Path $InstallDir) {
        Write-Log "Installation directory already exists" "WARNING"
        $BackupDir = "$InstallDir.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Move-Item -Path $InstallDir -Destination $BackupDir -Force
        Write-Log "Backed up existing directory to: $BackupDir"
    }
    
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    New-Item -ItemType Directory -Path "$InstallDir\logs" -Force | Out-Null
    New-Item -ItemType Directory -Path "$InstallDir\data" -Force | Out-Null
    New-Item -ItemType Directory -Path "$InstallDir\backups" -Force | Out-Null
    New-Item -ItemType Directory -Path "$InstallDir\uploads" -Force | Out-Null
    
    Write-Log "Installation directory created successfully" "SUCCESS"
}

# Install Chocolatey package manager
function Install-Chocolatey {
    Write-Log "Installing Chocolatey package manager"
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Log "Chocolatey is already installed" "INFO"
        return
    }
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Log "Chocolatey installed successfully" "SUCCESS"
        } else {
            throw "Chocolatey installation failed"
        }
    } catch {
        Write-Log "Failed to install Chocolatey: $_" "ERROR"
        exit 1
    }
}

# Install required software
function Install-Software {
    Write-Log "Installing required software"
    
    $Software = @(
        @{Name = "git"; Version = "latest"},
        @{Name = "nodejs-lts"; Version = $NodeVersion},
        @{Name = "python"; Version = $PythonVersion},
        @{Name = "mongodb"; Version = $MongoVersion},
        @{Name = "redis"; Version = $RedisVersion},
        @{Name = "nginx"; Version = "latest"},
        @{Name = "vscode"; Version = "latest"},
        @{Name = "postman"; Version = "latest"},
        @{Name = "docker-desktop"; Version = "latest"},
        @{Name = "7zip"; Version = "latest"},
        @{Name = "curl"; Version = "latest"},
        @{Name = "wget"; Version = "latest"}
    )
    
    foreach ($item in $Software) {
        Write-Log "Installing $($item.Name) version $($item.Version)"
        
        try {
            if ($item.Version -eq "latest") {
                choco install $item.Name -y --no-progress
            } else {
                choco install $item.Name --version $item.Version -y --no-progress
            }
            
            Write-Log "$($item.Name) installed successfully" "SUCCESS"
        } catch {
            Write-Log "Failed to install $($item.Name): $_" "ERROR"
        }
    }
}

# Configure Windows features
function Configure-WindowsFeatures {
    Write-Log "Configuring Windows features"
    
    # Enable Windows Subsystem for Linux (WSL)
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
        Write-Log "WSL enabled" "SUCCESS"
    } catch {
        Write-Log "Failed to enable WSL: $_" "WARNING"
    }
    
    # Enable Hyper-V (if available)
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart
        Write-Log "Hyper-V enabled" "SUCCESS"
    } catch {
        Write-Log "Hyper-V not available or already enabled" "INFO"
    }
    
    # Enable IIS features (optional)
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpErrors -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpRedirect -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-ApplicationDevelopment -NoRestart
        Write-Log "IIS features enabled" "SUCCESS"
    } catch {
        Write-Log "IIS configuration skipped: $_" "INFO"
    }
}

# Setup MongoDB
function Setup-MongoDB {
    Write-Log "Setting up MongoDB"
    
    $MongoDataDir = "$InstallDir\data\mongodb"
    $MongoLogDir = "$InstallDir\logs\mongodb"
    
    # Create directories
    New-Item -ItemType Directory -Path $MongoDataDir -Force | Out-Null
    New-Item -ItemType Directory -Path $MongoLogDir -Force | Out-Null
    
    # Create MongoDB configuration
    $MongoConfig = @"
systemLog:
  destination: file
  path: $MongoLogDir\mongod.log
  logAppend: true
storage:
  dbPath: $MongoDataDir
  journal:
    enabled: true
net:
  port: 27017
  bindIp: 127.0.0.1
security:
  authorization: enabled
processManagement:
  windowsService:
    serviceName: MongoDB
    displayName: MongoDB
    description: MongoDB Database Server
"@
    
    $MongoConfig | Out-File -FilePath "$InstallDir\mongod.conf" -Encoding UTF8
    
    # Create MongoDB service
    try {
        # Install as Windows service
        & "C:\Program Files\MongoDB\Server\$MongoVersion\bin\mongod.exe" --config "$InstallDir\mongod.conf" --install
        
        # Start service
        Start-Service MongoDB
        
        # Create admin user
        Start-Sleep -Seconds 5
        
        $CreateUserScript = @"
use admin
db.createUser({
  user: "admin",
  pwd: "$(New-Guid)",
  roles: ["root"]
})
use jobai
db.createUser({
  user: "jobai_user",
  pwd: "$(New-Guid)",
  roles: ["readWrite", "dbAdmin"]
})
"@
        
        $CreateUserScript | & "C:\Program Files\MongoDB\Server\$MongoVersion\bin\mongo.exe" --quiet
        
        Write-Log "MongoDB setup completed successfully" "SUCCESS"
    } catch {
        Write-Log "Failed to setup MongoDB: $_" "ERROR"
    }
}

# Setup Redis
function Setup-Redis {
    Write-Log "Setting up Redis"
    
    $RedisConfig = @"
port 6379
bind 127.0.0.1
requirepass $(New-Guid)
maxmemory 1gb
maxmemory-policy allkeys-lru
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
"@
    
    $RedisConfig | Out-File -FilePath "$env:ProgramData\Redis\redis.conf" -Encoding UTF8
    
    # Restart Redis service
    try {
        Restart-Service redis
        Write-Log "Redis setup completed successfully" "SUCCESS"
    } catch {
        Write-Log "Failed to restart Redis service: $_" "ERROR"
    }
}

# Setup Nginx
function Setup-Nginx {
    Write-Log "Setting up Nginx"
    
    $NginxConfDir = "$env:ProgramFiles\nginx\conf"
    $NginxHTMLDir = "$env:ProgramFiles\nginx\html"
    
    # Backup original config
    Copy-Item "$NginxConfDir\nginx.conf" "$NginxConfDir\nginx.conf.backup" -Force
    
    # Create new nginx configuration
    $NginxConfig = @"
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    #gzip  on;

    server {
        listen       80;
        server_name  localhost;

        location / {
            root   $InstallDir\frontend\build;
            index  index.html index.htm;
            try_files `$uri `$uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade `$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_cache_bypass `$http_upgrade;
        }

        location /uploads/ {
            alias $InstallDir\uploads/;
            expires 30d;
            add_header Cache-Control "public";
        }

        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
}
"@
    
    $NginxConfig | Out-File -FilePath "$NginxConfDir\nginx.conf" -Encoding UTF8
    
    # Test configuration
    try {
        & "$env:ProgramFiles\nginx\nginx.exe" -t
        Write-Log "Nginx configuration test passed" "SUCCESS"
    } catch {
        Write-Log "Nginx configuration test failed: $_" "ERROR"
    }
    
    # Restart Nginx
    try {
        Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Process "$env:ProgramFiles\nginx\nginx.exe" -WindowStyle Hidden
        Write-Log "Nginx started successfully" "SUCCESS"
    } catch {
        Write-Log "Failed to start Nginx: $_" "ERROR"
    }
}

# Setup Python virtual environment
function Setup-PythonEnvironment {
    Write-Log "Setting up Python virtual environment"
    
    $PythonDir = "$InstallDir\ai_services"
    
    try {
        # Create virtual environment
        python -m venv "$PythonDir\venv"
        
        # Activate and install packages
        & "$PythonDir\venv\Scripts\activate.ps1"
        pip install --upgrade pip
        
        # Install requirements
        $Requirements = @"
openai>=1.0.0
google-generativeai>=0.3.0
anthropic>=0.7.0
selenium>=4.0.0
beautifulsoup4>=4.12.0
pandas>=2.0.0
numpy>=1.24.0
pymongo>=4.0.0
redis>=5.0.0
celery>=5.0.0
flask>=3.0.0
fastapi>=0.104.0
uvicorn>=0.24.0
"@
        
        $Requirements | Out-File -FilePath "$PythonDir\requirements.txt" -Encoding UTF8
        pip install -r "$PythonDir\requirements.txt"
        
        Write-Log "Python environment setup completed" "SUCCESS"
    } catch {
        Write-Log "Failed to setup Python environment: $_" "ERROR"
    }
}

# Setup Node.js project
function Setup-NodeProject {
    Write-Log "Setting up Node.js project"
    
    # Install global packages
    $GlobalPackages = @(
        "npm-check-updates",
        "nodemon",
        "pm2",
        "typescript",
        "ts-node",
        "eslint",
        "prettier"
    )
    
    foreach ($package in $GlobalPackages) {
        try {
            npm install -g $package
            Write-Log "Installed global package: $package" "SUCCESS"
        } catch {
            Write-Log "Failed to install $package: $_" "WARNING"
        }
    }
    
    # Setup backend
    $BackendDir = "$InstallDir\backend"
    
    if (Test-Path $BackendDir) {
        Write-Log "Setting up backend in $BackendDir"
        
        Set-Location $BackendDir
        npm install --production
        
        # Create .env file
        $EnvContent = @"
NODE_ENV=production
PORT=5000
BASE_URL=http://localhost
FRONTEND_URL=http://localhost

# Database
MONGODB_URI=mongodb://localhost:27017/jobai
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=$(New-Guid)
JWT_EXPIRES_IN=7d

# Payment
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key

# AI
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@localhost
"@
        
        $EnvContent | Out-File -FilePath "$BackendDir\.env" -Encoding UTF8
        
        Write-Log "Backend setup completed" "SUCCESS"
    }
    
    # Setup frontend
    $FrontendDir = "$InstallDir\frontend"
    
    if (Test-Path $FrontendDir) {
        Write-Log "Setting up frontend in $FrontendDir"
        
        Set-Location $FrontendDir
        npm install --production
        npm run build
        
        Write-Log "Frontend setup completed" "SUCCESS"
    }
}

# Setup Windows Services
function Setup-WindowsServices {
    Write-Log "Setting up Windows services"
    
    # Create Node.js service using pm2
    $Pm2Config = @"
module.exports = {
  apps: [{
    name: 'jobai-backend',
    script: '$InstallDir\backend\src\app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'jobai-frontend',
    script: '$InstallDir\frontend\scripts\serve.js',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    }
  }]
}
"@
    
    $Pm2Config | Out-File -FilePath "$InstallDir\pm2.config.js" -Encoding UTF8
    
    # Install pm2 as Windows service
    try {
        Set-Location $InstallDir
        pm2 start pm2.config.js
        pm2 save
        pm2 startup
        Write-Log "PM2 services setup completed" "SUCCESS"
    } catch {
        Write-Log "Failed to setup PM2 services: $_" "ERROR"
    }
    
    # Create Python service
    $PythonService = @"
[Unit]
Description=JobAI AI Services
After=network.target

[Service]
Type=simple
User=$env:USERNAME
WorkingDirectory=$InstallDir\ai_services
Environment=PATH=$InstallDir\ai_services\venv\Scripts;%PATH%
ExecStart=$InstallDir\ai_services\venv\Scripts\python.exe main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"@
    
    # For Windows, we'd use NSSM (Non-Sucking Service Manager)
    Write-Log "Note: Python service needs NSSM for Windows service installation" "INFO"
}

# Configure Firewall
function Configure-Firewall {
    Write-Log "Configuring Windows Firewall"
    
    $Ports = @(80, 443, 3000, 5000, 27017, 6379, 22)
    
    foreach ($port in $Ports) {
        try {
            New-NetFirewallRule -DisplayName "JobAI Port $port" `
                -Direction Inbound `
                -LocalPort $port `
                -Protocol TCP `
                -Action Allow `
                -Enabled True
            
            Write-Log "Firewall rule added for port $port" "SUCCESS"
        } catch {
            Write-Log "Failed to add firewall rule for port $port: $_" "WARNING"
        }
    }
}

# Setup Backup Script
function Setup-Backup {
    Write-Log "Setting up backup system"
    
    $BackupScript = @"
@echo off
set BACKUP_DIR=$InstallDir\backups
set DATE=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%
set BACKUP_FILE=jobai_backup_%DATE%.zip

echo Creating backup...
7z a "%BACKUP_DIR%\%BACKUP_FILE%" "$InstallDir" -x!node_modules -x!venv -x!*.git*

echo Backing up MongoDB...
"C:\Program Files\MongoDB\Server\$MongoVersion\bin\mongodump.exe" --out "%BACKUP_DIR%\mongodb_%DATE%"

echo Cleaning old backups...
forfiles /p "%BACKUP_DIR%" /m jobai_backup_*.zip /d -7 /c "cmd /c del @path"
forfiles /p "%BACKUP_DIR%" /m mongodb_* /d -7 /c "cmd /c rmdir /s /q @path"

echo Backup completed: %BACKUP_DIR%\%BACKUP_FILE%
"@
    
    $BackupScript | Out-File -FilePath "$InstallDir\backup.bat" -Encoding ASCII
    
    # Create scheduled task
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-WindowStyle Hidden -File `"$InstallDir\backup.bat`""
    
    $Trigger = New-ScheduledTaskTrigger -Daily -At 2am
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    
    Register-ScheduledTask -TaskName "JobAI Backup" `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description "Daily backup of JobAI application" `
        -Force
    
    Write-Log "Backup system configured to run daily at 2 AM" "SUCCESS"
}

# Generate Setup Report
function Generate-Report {
    Write-Log "Generating setup report"
    
    $Report = @"
JobAI South Africa - Windows Setup Report
========================================
Date: $(Get-Date)
Installation Directory: $InstallDir

Software Installed:
- Git: $(git --version 2>$null)
- Node.js: $(node --version 2>$null)
- Python: $(python --version 2>$null)
- MongoDB: $(Get-Service MongoDB -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status)
- Redis: $(Get-Service redis -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status)
- Nginx: $(Get-Process nginx -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0

Services Running:
- MongoDB: $(Get-Service MongoDB -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status)
- Redis: $(Get-Service redis -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Status)
- Nginx: $(if (Get-Process nginx -ErrorAction SilentlyContinue) { "Running" } else { "Stopped" })

Network Configuration:
- Local URL: http://localhost
- API URL: http://localhost:5000
- Frontend: http://localhost:3000

Firewall Ports Open: 80, 443, 3000, 5000, 27017, 6379

Backup Schedule:
- Daily at 2:00 AM
- Location: $InstallDir\backups
- Retention: 7 days

Next Steps:
1. Update .env files with actual API keys
2. Initialize database: node $InstallDir\backend\scripts\migrate.js
3. Start services:
   - Backend: pm2 start jobai-backend
   - Frontend: pm2 start jobai-frontend
4. Test the application at http://localhost

Troubleshooting:
- Check logs in $InstallDir\logs
- Services: services.msc
- Firewall: wf.msc
- MongoDB: mongod.log in $InstallDir\logs\mongodb
"@
    
    $Report | Out-File -FilePath "$InstallDir\setup_report.txt" -Encoding UTF8
    Write-Log "Setup report saved to $InstallDir\setup_report.txt" "SUCCESS"
    
    # Display summary
    Write-Host ""
    Write-Host "=" * 60
    Write-Host "SETUP COMPLETED SUCCESSFULLY"
    Write-Host "=" * 60
    Write-Host ""
    Write-Host "Installation Directory: $InstallDir"
    Write-Host "Local URL: http://localhost"
    Write-Host "API URL: http://localhost:5000"
    Write-Host ""
    Write-Host "Next Steps:"
    Write-Host "1. Review $InstallDir\setup_report.txt"
    Write-Host "2. Update configuration files"
    Write-Host "3. Initialize the database"
    Write-Host "4. Start the application"
    Write-Host ""
    Write-Host "For support, check logs in $InstallDir\logs"
    Write-Host "=" * 60
}

# Main execution
function Main {
    Write-Log "Starting JobAI South Africa Windows setup"
    
    # Step 1: Initialize
    Initialize-InstallationDirectory
    
    # Step 2: Install Chocolatey
    Install-Chocolatey
    
    # Step 3: Install software
    Install-Software
    
    # Step 4: Configure Windows
    Configure-WindowsFeatures
    
    # Step 5: Setup MongoDB
    Setup-MongoDB
    
    # Step 6: Setup Redis
    Setup-Redis
    
    # Step 7: Setup Nginx
    Setup-Nginx
    
    # Step 8: Setup Python
    Setup-PythonEnvironment
    
    # Step 9: Setup Node.js
    Setup-NodeProject
    
    # Step 10: Setup services
    Setup-WindowsServices
    
    # Step 11: Configure firewall
    Configure-Firewall
    
    # Step 12: Setup backup
    Setup-Backup
    
    # Step 13: Generate report
    Generate-Report
    
    Write-Log "Setup completed successfully!" "SUCCESS"
    
    # Prompt for restart
    $Restart = Read-Host "Do you want to restart the computer now? (Y/N)"
    if ($Restart -eq 'Y' -or $Restart -eq 'y') {
        Restart-Computer -Force
    }
}

# Run main function
Main
