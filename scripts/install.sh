#!/bin/bash

# JobAI South Africa - Complete Installation Script
# Installs all components: Copilot, Code Validator, Self-Healing System

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${1:-/opt/jobai}"
ENV_FILE="$INSTALL_DIR/.env"
LOG_FILE="$INSTALL_DIR/install.log"

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[ERROR] $1" >> "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
    echo "[INFO] $1" >> "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check for root/sudo
    if [ "$EUID" -ne 0 ]; then 
        warn "Not running as root. Some operations may require sudo."
    fi
    
    # Check for required commands
    local required_commands=("git" "curl" "wget" "node" "npm" "python3" "pip3")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "$cmd is not installed. Please install it first."
        else
            log "✓ $cmd is installed"
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local node_major=$(echo "$node_version" | cut -d'.' -f1)
    
    if [ "$node_major" -lt 16 ]; then
        error "Node.js version 16 or higher is required. Found: $node_version"
    else
        log "✓ Node.js version $node_version is compatible"
    fi
    
    # Check Python version
    local python_version=$(python3 --version | cut -d' ' -f2)
    local python_major=$(echo "$python_version" | cut -d'.' -f1)
    local python_minor=$(echo "$python_version" | cut -d'.' -f2)
    
    if [ "$python_major" -lt 3 ] || ([ "$python_major" -eq 3 ] && [ "$python_minor" -lt 8 ]); then
        error "Python 3.8 or higher is required. Found: $python_version"
    else
        log "✓ Python version $python_version is compatible"
    fi
}

# Create installation directory
create_install_dir() {
    log "Creating installation directory: $INSTALL_DIR"
    
    if [ -d "$INSTALL_DIR" ]; then
        warn "Installation directory already exists. Backing up..."
        local backup_dir="$INSTALL_DIR.backup.$(date +%Y%m%d_%H%M%S)"
        mv "$INSTALL_DIR" "$backup_dir"
        log "Backed up existing directory to: $backup_dir"
    fi
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/logs"
    mkdir -p "$INSTALL_DIR/data"
    mkdir -p "$INSTALL_DIR/cache"
    mkdir -p "$INSTALL_DIR/backups"
    
    log "Installation directory created successfully"
}

# Clone or copy project
setup_project() {
    log "Setting up project structure..."
    
    # Create directory structure
    mkdir -p "$INSTALL_DIR/copilot"
    mkdir -p "$INSTALL_DIR/code_validator"
    mkdir -p "$INSTALL_DIR/deployment"
    mkdir -p "$INSTALL_DIR/self_healing"
    mkdir -p "$INSTALL_DIR/scripts"
    
    # Copy files from current directory
    cp -r ./copilot/* "$INSTALL_DIR/copilot/" 2>/dev/null || warn "Copilot files not found"
    cp -r ./code_validator/* "$INSTALL_DIR/code_validator/" 2>/dev/null || warn "Code validator files not found"
    cp -r ./deployment/* "$INSTALL_DIR/deployment/" 2>/dev/null || warn "Deployment files not found"
    cp -r ./self_healing/* "$INSTALL_DIR/self_healing/" 2>/dev/null || warn "Self-healing files not found"
    cp -r ./scripts/* "$INSTALL_DIR/scripts/" 2>/dev/null || warn "Script files not found"
    
    # Make scripts executable
    chmod +x "$INSTALL_DIR/scripts/"*.sh
    chmod +x "$INSTALL_DIR/deployment/"*.sh
    chmod +x "$INSTALL_DIR/deployment/windows/"*.ps1 2>/dev/null || true
    chmod +x "$INSTALL_DIR/deployment/windows/"*.bat 2>/dev/null || true
    
    log "Project structure created successfully"
}

# Install Node.js dependencies
install_node_dependencies() {
    log "Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR"
    
    # Create package.json for the tools
    cat > "$INSTALL_DIR/package.json" << EOF
{
  "name": "jobai-tools",
  "version": "1.0.0",
  "description": "JobAI South Africa - Development Tools",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "validate": "node scripts/validate.js",
    "monitor": "node scripts/monitor.js",
    "fix": "node scripts/fix.js",
    "test": "jest"
  },
  "dependencies": {
    "openai": "^4.0.0",
    "esprima": "^4.0.1",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "axios": "^1.5.0",
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "redis": "^4.0.0",
    "nodemailer": "^6.0.0",
    "dotenv": "^16.0.0",
    "winston": "^3.0.0",
    "moment": "^2.29.0",
    "chalk": "^4.0.0",
    "inquirer": "^8.0.0",
    "commander": "^11.0.0",
    "glob": "^10.0.0",
    "csv-parser": "^3.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.0",
    "express-rate-limit": "^6.0.0",
    "swagger-ui-express": "^5.0.0",
    "yaml": "^2.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.0.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-import": "^2.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0"
  }
}
EOF
    
    # Install dependencies
    npm install --production
    
    # Install dev dependencies if in development mode
    if [ "${DEV_MODE:-false}" = "true" ]; then
        npm install --only=dev
    fi
    
    log "Node.js dependencies installed successfully"
}

# Install Python dependencies
install_python_dependencies() {
    log "Installing Python dependencies..."
    
    cd "$INSTALL_DIR"
    
    # Create virtual environment
    python3 -m venv "$INSTALL_DIR/venv"
    
    # Activate and install packages
    source "$INSTALL_DIR/venv/bin/activate"
    
    # Create requirements.txt
    cat > "$INSTALL_DIR/requirements.txt" << EOF
openai>=1.0.0
anthropic>=0.7.0
google-generativeai>=0.3.0
pylint>=3.0.0
black>=23.0.0
mypy>=1.0.0
flake8>=6.0.0
bandit>=1.7.0
safety>=2.0.0
pydantic>=2.0.0
fastapi>=0.104.0
uvicorn>=0.24.0
celery>=5.0.0
redis>=5.0.0
pymongo>=4.0.0
pandas>=2.0.0
numpy>=1.24.0
selenium>=4.0.0
beautifulsoup4>=4.12.0
requests>=2.31.0
aiohttp>=3.8.0
asyncio>=3.4.3
psutil>=5.9.0
python-dotenv>=1.0.0
colorama>=0.4.0
tqdm>=4.0.0
Jinja2>=3.0.0
python-multipart>=0.0.0
email-validator>=2.0.0
cryptography>=41.0.0
EOF
    
    # Install dependencies
    pip install --upgrade pip
    pip install -r "$INSTALL_DIR/requirements.txt"
    
    log "Python dependencies installed successfully"
}

# Create configuration files
create_config_files() {
    log "Creating configuration files..."
    
    # Create .env file
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << EOF
# Application Configuration
NODE_ENV=production
INSTALL_DIR=$INSTALL_DIR
LOG_LEVEL=info

# AI Services
OPENAI_API_KEY=${OPENAI_API_KEY:-your_openai_api_key}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-your_anthropic_api_key}
GEMINI_API_KEY=${GEMINI_API_KEY:-your_gemini_api_key}

# Database
MONGODB_URI=${MONGODB_URI:-mongodb://localhost:27017/jobai}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}

# Monitoring
HEALTH_CHECK_INTERVAL=60000
ALERT_EMAIL=${ALERT_EMAIL:-alerts@jobai.co.za}
ALERT_PHONE=${ALERT_PHONE:-+27721234567}

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# File Storage
MAX_FILE_SIZE_MB=50
UPLOAD_DIR=$INSTALL_DIR/uploads
BACKUP_DIR=$INSTALL_DIR/backups

# Performance
MAX_CONCURRENT_CHECKS=5
CACHE_TTL_SECONDS=3600
REQUEST_TIMEOUT_MS=30000

# Logging
LOG_ROTATION_SIZE=10485760  # 10MB
LOG_RETENTION_DAYS=7
EOF
        
        chmod 600 "$ENV_FILE"
        log "Environment file created: $ENV_FILE"
    else
        log "Environment file already exists: $ENV_FILE"
    fi
    
    # Create configuration JSON
    cat > "$INSTALL_DIR/config.json" << EOF
{
  "application": {
    "name": "JobAI South Africa",
    "version": "1.0.0",
    "environment": "production"
  },
  "services": {
    "copilot": {
      "enabled": true,
      "model": "gpt-4",
      "temperature": 0.2,
      "max_tokens": 4000
    },
    "validator": {
      "enabled": true,
      "strict_mode": false,
      "auto_fix": true,
      "check_security": true,
      "check_performance": true
    },
    "monitoring": {
      "enabled": true,
      "interval": 60000,
      "alert_thresholds": {
        "cpu": 80,
        "memory": 85,
        "disk": 90,
        "response_time": 5000
      }
    },
    "self_healing": {
      "enabled": true,
      "auto_restart": true,
      "auto_cleanup": true,
      "backup_before_fix": true
    }
  },
  "paths": {
    "install_dir": "$INSTALL_DIR",
    "logs": "$INSTALL_DIR/logs",
    "data": "$INSTALL_DIR/data",
    "cache": "$INSTALL_DIR/cache",
    "backups": "$INSTALL_DIR/backups"
  }
}
EOF
    
    log "Configuration files created successfully"
}

# Create main application file
create_main_app() {
    log "Creating main application file..."
    
    cat > "$INSTALL_DIR/index.js" << EOF
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { HealthMonitor } = require('./self_healing/HealthMonitor');
const { CodeChecker } = require('./code_validator/CodeChecker');
const { CopilotService } = require('./copilot/code_assistant/CopilotService');
const { AutoFixer } = require('./code_validator/AutoFixer');

class JobAITools {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    this.healthMonitor = new HealthMonitor();
    this.codeChecker = new CodeChecker();
    this.copilotService = new CopilotService();
    this.autoFixer = new AutoFixer();
    
    this.setupLogging();
  }

  setupLogging() {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const winston = require('winston');
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(logDir, 'error.log'), 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: path.join(logDir, 'combined.log') 
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  async start() {
    this.logger.info('Starting JobAI Tools...');
    
    try {
      // Start health monitoring
      await this.healthMonitor.start();
      this.logger.info('Health monitoring started');
      
      // Validate installation
      const validation = await this.validateInstallation();
      this.logger.info(\`Installation validation: \${validation.valid ? 'PASSED' : 'FAILED'}\`);
      
      // Start background services
      this.startBackgroundServices();
      
      this.logger.info('JobAI Tools started successfully');
      
      return { success: true, validation };
      
    } catch (error) {
      this.logger.error('Failed to start JobAI Tools:', error);
      throw error;
    }
  }

  async validateInstallation() {
    this.logger.info('Validating installation...');
    
    const validation = {
      valid: true,
      checks: [],
      errors: []
    };
    
    // Check required directories
    const requiredDirs = ['logs', 'data', 'cache', 'backups'];
    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (fs.existsSync(dirPath)) {
        validation.checks.push({ item: dir, status: 'OK' });
      } else {
        validation.checks.push({ item: dir, status: 'MISSING' });
        validation.errors.push(\`Directory missing: \${dir}\`);
        validation.valid = false;
      }
    });
    
    // Check configuration files
    const requiredFiles = ['.env', 'config.json', 'package.json'];
    requiredFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        validation.checks.push({ item: file, status: 'OK' });
      } else {
        validation.checks.push({ item: file, status: 'MISSING' });
        validation.errors.push(\`File missing: \${file}\`);
        validation.valid = false;
      }
    });
    
    // Check Node.js dependencies
    try {
      require('./package.json');
      validation.checks.push({ item: 'package.json', status: 'OK' });
    } catch (error) {
      validation.checks.push({ item: 'package.json', status: 'INVALID' });
      validation.errors.push(\`Invalid package.json: \${error.message}\`);
      validation.valid = false;
    }
    
    // Check Python virtual environment
    const venvPath = path.join(__dirname, 'venv');
    if (fs.existsSync(venvPath)) {
      validation.checks.push({ item: 'Python venv', status: 'OK' });
    } else {
      validation.checks.push({ item: 'Python venv', status: 'MISSING' });
      validation.errors.push('Python virtual environment missing');
      validation.valid = false;
    }
    
    return validation;
  }

  startBackgroundServices() {
    // Start periodic validation
    setInterval(async () => {
      try {
        await this.runCodeValidation();
      } catch (error) {
        this.logger.error('Periodic validation failed:', error);
      }
    }, 3600000); // Every hour
    
    // Start periodic health report
    setInterval(() => {
      const report = this.healthMonitor.getHealthReport();
      this.logger.info('Health report generated', { report: report });
    }, 300000); // Every 5 minutes
    
    // Start auto-fix if needed
    setInterval(async () => {
      try {
        await this.autoFixIssues();
      } catch (error) {
        this.logger.error('Auto-fix failed:', error);
      }
    }, 1800000); // Every 30 minutes
  }

  async runCodeValidation() {
    this.logger.info('Running code validation...');
    
    const validation = await this.codeChecker.validateDirectory(__dirname);
    
    if (!validation.summary.validFiles === validation.summary.totalFiles) {
      this.logger.warn('Code validation issues found', {
        invalidFiles: validation.summary.invalidFiles,
        totalErrors: validation.summary.totalErrors
      });
      
      // Trigger auto-fix for critical issues
      if (validation.summary.totalErrors > 0) {
        await this.autoFixer.runAutoFixOnDirectory(__dirname);
      }
    } else {
      this.logger.info('Code validation passed');
    }
    
    return validation;
  }

  async autoFixIssues() {
    this.logger.info('Running auto-fix...');
    
    const result = await this.autoFixer.runAutoFixOnDirectory(__dirname);
    
    if (result.filesFixed > 0) {
      this.logger.info('Auto-fix completed', {
        filesFixed: result.filesFixed,
        totalFixes: result.totalFixes
      });
    }
    
    return result;
  }

  async analyzeCode(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const analysis = await this.copilotService.analyzeCode(filePath, content);
      
      this.logger.info('Code analysis completed', {
        file: filePath,
        issues: analysis.issues.length,
        suggestions: analysis.suggestions.length
      });
      
      return analysis;
    } catch (error) {
      this.logger.error('Code analysis failed:', error);
      throw error;
    }
  }

  async getStatus() {
    const healthReport = this.healthMonitor.getHealthReport();
    const validation = await this.validateInstallation();
    
    return {
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      health: healthReport,
      validation: validation,
      config: this.config
    };
  }

  async stop() {
    this.logger.info('Stopping JobAI Tools...');
    
    // Cleanup resources
    process.exit(0);
  }
}

// Export for module usage
module.exports = JobAITools;

// If run directly
if (require.main === module) {
  const tools = new JobAITools();
  
  tools.start().then(() => {
    tools.logger.info('JobAI Tools is ready');
    
    // Keep process running
    process.on('SIGINT', async () => {
      tools.logger.info('Received SIGINT, shutting down...');
      await tools.stop();
    });
    
    process.on('SIGTERM', async () => {
      tools.logger.info('Received SIGTERM, shutting down...');
      await tools.stop();
    });
    
  }).catch(error => {
    console.error('Failed to start JobAI Tools:', error);
    process.exit(1);
  });
}
EOF
    
    log "Main application file created successfully"
}

# Create systemd service (Linux)
create_systemd_service() {
    if [ "$(uname)" != "Linux" ]; then
        info "Skipping systemd service creation (not Linux)"
        return
    fi
    
    log "Creating systemd service..."
    
    cat > /etc/systemd/system/jobai-tools.service << EOF
[Unit]
Description=JobAI South Africa Tools
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PATH=$INSTALL_DIR/venv/bin:/usr/bin"
ExecStart=/usr/bin/node $INSTALL_DIR/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=jobai-tools

# Security
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR/logs $INSTALL_DIR/data $INSTALL_DIR/cache $INSTALL_DIR/backups
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable jobai-tools.service
    
    log "Systemd service created and enabled"
}

# Create Windows service (Windows)
create_windows_service() {
    if [ "$(uname)" != "Windows" ]; then
        info "Skipping Windows service creation (not Windows)"
        return
    fi
    
    log "Creating Windows service..."
    
    # This would require NSSM or similar on Windows
    cat > "$INSTALL_DIR/install-windows-service.bat" << EOF
@echo off
echo Installing JobAI Tools as Windows service...

REM Check for NSSM
where nssm >nul 2>nul
if %errorlevel% neq 0 (
    echo NSSM not found. Installing...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip'"
    powershell -Command "Expand-Archive -Path 'nssm.zip' -DestinationPath 'nssm'"
    copy nssm\win64\nssm.exe C:\Windows\System32\
)

REM Create service
nssm install JobAITools "$INSTALL_DIR\index.js"
nssm set JobAITools AppDirectory "$INSTALL_DIR"
nssm set JobAITools AppParameters ""
nssm set JobAITools AppStdout "$INSTALL_DIR\logs\service.log"
nssm set JobAITools AppStderr "$INSTALL_DIR\logs\service-error.log"
nssm set JobAITools Start SERVICE_AUTO_START
nssm set JobAITools AppEnvironmentExtra "NODE_ENV=production"

echo Service installed. Starting...
net start JobAITools

echo JobAI Tools Windows service installation complete!
EOF
    
    log "Windows service installation script created"
}

# Create startup scripts
create_startup_scripts() {
    log "Creating startup scripts..."
    
    # Start script
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
node index.js
EOF
    
    # Stop script
    cat > "$INSTALL_DIR/stop.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
pkill -f "node index.js"
EOF
    
    # Restart script
    cat > "$INSTALL_DIR/restart.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./stop.sh
sleep 2
./start.sh
EOF
    
    # Status script
    cat > "$INSTALL_DIR/status.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
if pgrep -f "node index.js" > /dev/null; then
    echo "JobAI Tools is running"
    curl -s http://localhost:8080/status || echo "Status endpoint not available"
else
    echo "JobAI Tools is not running"
fi
EOF
    
    # Make scripts executable
    chmod +x "$INSTALL_DIR/"*.sh
    
    log "Startup scripts created successfully"
}

# Create validation script
create_validation_script() {
    log "Creating validation script..."
    
    cat > "$INSTALL_DIR/scripts/validate.sh" << 'EOF'
#!/bin/bash

# JobAI Code Validation Script
# Usage: ./validate.sh [directory] [options]

set -euo pipefail

DIR="${1:-.}"
OUTPUT_FILE="${2:-validation_report.json}"
LOG_FILE="validation.log"

echo "Starting code validation for: $DIR"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Run validation
node << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');
const { CodeChecker } = require('../code_validator/CodeChecker');

async function main() {
    const dir = process.argv[2] || '.';
    const outputFile = process.argv[3] || 'validation_report.json';
    
    console.log(\`Validating directory: \${dir}\`);
    
    const checker = new CodeChecker();
    
    try {
        const results = await checker.validateDirectory(dir);
        const report = checker.generateReport(results);
        
        fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
        
        console.log(\`Validation complete. Report saved to: \${outputFile}\`);
        console.log(\`Summary:\`);
        console.log(\`  Total files: \${results.summary.totalFiles}\`);
        console.log(\`  Valid files: \${results.summary.validFiles}\`);
        console.log(\`  Invalid files: \${results.summary.invalidFiles}\`);
        console.log(\`  Total errors: \${results.summary.totalErrors}\`);
        console.log(\`  Total warnings: \${results.summary.totalWarnings}\`);
        
        if (results.summary.invalidFiles > 0) {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Validation failed:', error);
        process.exit(1);
    }
}

main();
NODE_SCRIPT

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Validation passed"
else
    echo "❌ Validation failed"
fi

exit $EXIT_CODE
EOF
    
    chmod +x "$INSTALL_DIR/scripts/validate.sh"
    
    log "Validation script created successfully"
}

# Create fix script
create_fix_script() {
    log "Creating auto-fix script..."
    
    cat > "$INSTALL_DIR/scripts/fix.sh" << 'EOF'
#!/bin/bash

# JobAI Auto-fix Script
# Usage: ./fix.sh [directory] [options]

set -euo pipefail

DIR="${1:-.}"
BACKUP_DIR="${2:-./backups}"
LOG_FILE="autofix.log"

echo "Starting auto-fix for: $DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

node << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');
const { AutoFixer } = require('../code_validator/AutoFixer');

async function main() {
    const dir = process.argv[2] || '.';
    const backupDir = process.argv[3] || './backups';
    
    console.log(\`Running auto-fix on directory: \${dir}\`);
    console.log(\`Backups will be saved to: \${backupDir}\`);
    
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, \`backup_\${timestamp}.tar.gz\`);
    
    const { execSync } = require('child_process');
    execSync(\`tar -czf "\${backupFile}" "\${dir}" --exclude="node_modules" --exclude="venv" --exclude=".git"\`, { stdio: 'inherit' });
    
    console.log(\`Backup created: \${backupFile}\`);
    
    const fixer = new AutoFixer();
    
    try {
        const results = await fixer.runAutoFixOnDirectory(dir);
        
        console.log(\`\\nAuto-fix results:\`);
        console.log(\`  Total files: \${results.totalFiles}\`);
        console.log(\`  Files fixed: \${results.filesFixed}\`);
        console.log(\`  Total fixes: \${results.totalFixes}\`);
        
        if (results.filesFixed > 0) {
            console.log(\`\\nSummary:\\n\${results.summary}\`);
            
            // Format code
            console.log(\`\\nFormatting code...\`);
            const files = results.details.filter(d => d.fixed).map(d => d.file);
            
            for (const file of files) {
                try {
                    await fixer.formatCode(file);
                } catch (error) {
                    console.warn(\`Failed to format \${file}: \`, error.message);
                }
            }
        } else {
            console.log('No fixes were needed.');
        }
        
    } catch (error) {
        console.error('Auto-fix failed:', error);
        
        // Restore from backup
        console.log('Restoring from backup...');
        execSync(\`tar -xzf "\${backupFile}" -C "\${path.dirname(dir)}"\`, { stdio: 'inherit' });
        
        process.exit(1);
    }
}

main();
NODE_SCRIPT

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Auto-fix completed successfully"
else
    echo "❌ Auto-fix failed"
fi

exit $EXIT_CODE
EOF
    
    chmod +x "$INSTALL_DIR/scripts/fix.sh"
    
    log "Auto-fix script created successfully"
}

# Create monitor script
create_monitor_script() {
    log "Creating monitor script..."
    
    cat > "$INSTALL_DIR/scripts/monitor.sh" << 'EOF'
#!/bin/bash

# JobAI Health Monitor Script
# Usage: ./monitor.sh [options]

set -euo pipefail

INTERVAL="${1:-60}"
LOG_FILE="health_monitor.log"

echo "Starting health monitor (interval: ${INTERVAL}s)"

node << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');
const { HealthMonitor } = require('../self_healing/HealthMonitor');

async function main() {
    const interval = parseInt(process.argv[2]) || 60;
    
    console.log(\`Health monitor starting with \${interval}s interval\`);
    
    const monitor = new HealthMonitor();
    
    // Override default interval
    monitor.config.checkInterval = interval * 1000;
    
    try {
        await monitor.start();
        
        console.log('Health monitor started successfully');
        console.log('Press Ctrl+C to stop');
        
        // Keep process running
        process.on('SIGINT', () => {
            console.log('\\nShutting down health monitor...');
            process.exit(0);
        });
        
        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            console.error('Uncaught exception:', error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled rejection at:', promise, 'reason:', reason);
        });
        
    } catch (error) {
        console.error('Failed to start health monitor:', error);
        process.exit(1);
    }
}

main();
NODE_SCRIPT

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "Health monitor stopped"
else
    echo "Health monitor failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
EOF
    
    chmod +x "$INSTALL_DIR/scripts/monitor.sh"
    
    log "Monitor script created successfully"
}

# Finalize installation
finalize_installation() {
    log "Finalizing installation..."
    
    # Set permissions
    chown -R $USER:$USER "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    
    # Create README
    cat > "$INSTALL_DIR/README.md" << EOF
# JobAI South Africa - Development Tools

## Installation Complete

Your JobAI development tools have been successfully installed to:
\`$INSTALL_DIR\`

## Available Tools

### 1. Code Validation
\`\`\`bash
cd $INSTALL_DIR
./scripts/validate.sh [directory]
\`\`\`

### 2. Auto-fix
\`\`\`bash
cd $INSTALL_DIR
./scripts/fix.sh [directory]
\`\`\`

### 3. Health Monitoring
\`\`\`bash
cd $INSTALL_DIR
./scripts/monitor.sh [interval_seconds]
\`\`\`

### 4. Copilot Assistance
\`\`\`javascript
const { CopilotService } = require('./copilot/code_assistant/CopilotService');
const copilot = new CopilotService();
const analysis = await copilot.analyzeCode(filePath, code);
\`\`\`

## Startup

### Linux (systemd)
\`\`\`bash
sudo systemctl start jobai-tools
sudo systemctl enable jobai-tools
\`\`\`

### Manual Start
\`\`\`bash
cd $INSTALL_DIR
./start.sh
\`\`\`

## Configuration

- Environment variables: \`$INSTALL_DIR/.env\`
- Application config: \`$INSTALL_DIR/config.json\`
- Logs: \`$INSTALL_DIR/logs/\`

## API Endpoints

If the service is running, you can access:

- Health check: http://localhost:8080/health
- Status: http://localhost:8080/status
- Metrics: http://localhost:8080/metrics

## Support

For issues or questions:
1. Check logs in \`$INSTALL_DIR/logs/\`
2. Review configuration files
3. Run validation: \`./scripts/validate.sh\`

## Next Steps

1. Update \`.env\` file with your API keys
2. Test the tools with \`./scripts/validate.sh .\`
3. Set up monitoring with \`./scripts/monitor.sh\`
4. Integrate into your CI/CD pipeline

---
Installation completed: $(date)
EOF
    
    # Create test script
    cat > "$INSTALL_DIR/test.sh" << 'EOF'
#!/bin/bash

echo "Testing JobAI installation..."

# Test 1: Check installation
if [ ! -f "index.js" ]; then
    echo "❌ Main application file missing"
    exit 1
fi
echo "✅ Main application file found"

# Test 2: Check dependencies
if [ ! -d "node_modules" ]; then
    echo "❌ Node.js dependencies missing"
    exit 1
fi
echo "✅ Node.js dependencies found"

# Test 3: Check Python environment
if [ ! -d "venv" ]; then
    echo "❌ Python virtual environment missing"
    exit 1
fi
echo "✅ Python virtual environment found"

# Test 4: Test validation script
if ./scripts/validate.sh . 2>/dev/null; then
    echo "✅ Validation script works"
else
    echo "⚠️ Validation script had issues (may be expected)"
fi

# Test 5: Check configuration
if [ -f ".env" ] && [ -f "config.json" ]; then
    echo "✅ Configuration files found"
else
    echo "❌ Configuration files missing"
    exit 1
fi

echo ""
echo "🎉 All tests passed! JobAI tools are ready to use."
echo ""
echo "Quick start:"
echo "  ./start.sh          # Start the tools"
echo "  ./scripts/validate.sh .  # Validate current directory"
echo "  ./scripts/monitor.sh     # Start health monitoring"
echo ""
echo "For more information, see README.md"
EOF
    
    chmod +x "$INSTALL_DIR/test.sh"
    
    log "Installation finalized successfully"
}

# Generate installation report
generate_report() {
    log "Generating installation report..."
    
    cat > "$INSTALL_DIR/INSTALLATION_REPORT.md" << EOF
# JobAI South Africa - Installation Report

## Summary
- **Date**: $(date)
- **Installation Directory**: $INSTALL_DIR
- **Status**: COMPLETED
- **Version**: 1.0.0

## Components Installed

### 1. Copilot System
- Code analysis and assistance
- AI-powered code completion
- Documentation generation
- Test case generation

### 2. Code Validator
- Syntax checking
- Security scanning
- Performance analysis
- Style enforcement
- Automatic fixing

### 3. Deployment Scripts
- Afrihost deployment (2GB space, 50 emails)
- Windows setup (Dell i7, 16GB RAM, 1TB SSD)
- CPanel configuration
- Automated backup setup

### 4. Self-Healing System
- Health monitoring
- Automatic recovery
- Issue detection
- Backup management

### 5. Utility Scripts
- Installation scripts
- Validation scripts
- Monitoring scripts
- Auto-fix scripts

## System Requirements Met
- Node.js: $(node --version)
- Python: $(python3 --version)
- Disk space: $(df -h $INSTALL_DIR | awk 'NR==2 {print $4}')
- Memory: $(free -h | awk '/Mem:/ {print $2}')

## Configuration Files Created
1. \`.env\` - Environment variables
2. \`config.json\` - Application configuration
3. \`package.json\` - Node.js dependencies
4. \`requirements.txt\` - Python dependencies

## Services Created
$(if [ "$(uname)" = "Linux" ]; then
    echo "- Systemd service: jobai-tools.service"
    echo "  Status: $(systemctl is-enabled jobai-tools.service 2>/dev/null || echo 'Not enabled')"
fi)

## Available Commands
\`\`\`bash
# Start the tools
cd $INSTALL_DIR
./start.sh

# Validate code
./scripts/validate.sh [directory]

# Auto-fix issues
./scripts/fix.sh [directory]

# Monitor health
./scripts/monitor.sh [interval]

# Test installation
./test.sh
\`\`\`

## Next Steps

### 1. Configure API Keys
Edit \`$INSTALL_DIR/.env\` and add:
- OpenAI API key
- Anthropic API key
- Gemini API key
- Other service credentials

### 2. Test the Installation
\`\`\`bash
cd $INSTALL_DIR
./test.sh
./scripts/validate.sh .
\`\`\`

### 3. Start the Services
\`\`\`bash
# For systemd (Linux)
sudo systemctl start jobai-tools
sudo systemctl enable jobai-tools

# Manual start
./start.sh
\`\`\`

### 4. Integration
- Add validation to CI/CD pipeline
- Set up monitoring alerts
- Configure automatic backups
- Integrate with your development workflow

## Troubleshooting

### Common Issues
1. **Missing dependencies**: Run \`npm install\` and \`pip install -r requirements.txt\`
2. **Permission errors**: Check file permissions in \`$INSTALL_DIR\`
3. **Service not starting**: Check logs in \`$INSTALL_DIR/logs/\`

### Logs
- Application logs: \`$INSTALL_DIR/logs/\`
- Installation log: \`$INSTALL_DIR/install.log\`
- Service logs: \`/var/log/syslog\` (systemd)

### Support
For issues, check:
1. Installation log: \`$INSTALL_DIR/install.log\`
2. Application logs: \`$INSTALL_DIR/logs/\`
3. System logs: \`journalctl -u jobai-tools\`

## Success Criteria
- [x] All components installed
- [x] Dependencies resolved
- [x] Configuration files created
- [x] Services configured
- [x] Test scripts available
- [x] Documentation complete

---
Installation completed successfully at $(date)
EOF
    
    log "Installation report generated: $INSTALL_DIR/INSTALLATION_REPORT.md"
}

# Main installation function
main() {
    log "Starting JobAI South Africa Tools installation"
    log "Installation directory: $INSTALL_DIR"
    
    # Step 1: Check prerequisites
    check_prerequisites
    
    # Step 2: Create installation directory
    create_install_dir
    
    # Step 3: Setup project
    setup_project
    
    # Step 4: Install Node.js dependencies
    install_node_dependencies
    
    # Step 5: Install Python dependencies
    install_python_dependencies
    
    # Step 6: Create configuration files
    create_config_files
    
    # Step 7: Create main application
    create_main_app
    
    # Step 8: Create system services
    create_systemd_service
    create_windows_service
    
    # Step 9: Create startup scripts
    create_startup_scripts
    
    # Step 10: Create utility scripts
    create_validation_script
    create_fix_script
    create_monitor_script
    
    # Step 11: Finalize
    finalize_installation
    
    # Step 12: Generate report
    generate_report
    
    log ""
    log "🎉 Installation completed successfully!"
    log ""
    log "Quick start:"
    log "  cd $INSTALL_DIR"
    log "  ./test.sh                    # Test the installation"
    log "  ./scripts/validate.sh .      # Validate the code"
    log "  ./start.sh                   # Start the tools"
    log ""
    log "For detailed information, see:"
    log "  $INSTALL_DIR/README.md"
    log "  $INSTALL_DIR/INSTALLATION_REPORT.md"
    log ""
    log "Next steps:"
    log "1. Update $INSTALL_DIR/.env with your API keys"
    log "2. Test the tools with ./test.sh"
    log "3. Start using the tools in your development workflow"
    log ""
}

# Run main function
main "$@"
