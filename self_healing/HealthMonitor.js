const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { performance } = require('perf_hooks');
const axios = require('axios');

class HealthMonitor {
  constructor() {
    this.config = {
      checkInterval: 60000, // 1 minute
      alertThresholds: {
        cpu: 80, // percentage
        memory: 85, // percentage
        disk: 90, // percentage
        responseTime: 5000, // milliseconds
        errorRate: 5 // percentage
      },
      services: [
        { name: 'nginx', command: 'nginx -t', restart: 'systemctl restart nginx' },
        { name: 'mongodb', command: 'mongod --version', restart: 'systemctl restart mongodb' },
        { name: 'redis', command: 'redis-cli ping', restart: 'systemctl restart redis' },
        { name: 'node_backend', port: 5000, restart: 'pm2 restart jobai-backend' },
        { name: 'node_frontend', port: 3000, restart: 'pm2 restart jobai-frontend' }
      ],
      endpoints: [
        { url: 'http://localhost:5000/health', name: 'Backend API' },
        { url: 'http://localhost:3000', name: 'Frontend' },
        { url: 'http://localhost/api/health', name: 'Nginx Proxy' }
      ]
    };
    
    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      responseTimes: {},
      errors: {},
      uptime: Date.now()
    };
    
    this.alerts = [];
    this.recoveryActions = [];
  }

  async start() {
    console.log('Starting Health Monitor...');
    
    // Initial system check
    await this.performSystemCheck();
    
    // Start periodic checks
    setInterval(async () => {
      await this.performSystemCheck();
    }, this.config.checkInterval);
    
    // Start service monitoring
    setInterval(async () => {
      await this.checkServices();
    }, 30000); // Every 30 seconds
    
    // Start endpoint monitoring
    setInterval(async () => {
      await this.checkEndpoints();
    }, 15000); // Every 15 seconds
    
    // Start cleanup job
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Every hour
    
    console.log('Health Monitor started successfully');
  }

  async performSystemCheck() {
    const checks = [
      this.checkCPU(),
      this.checkMemory(),
      this.checkDisk(),
      this.checkNetwork(),
      this.checkProcesses()
    ];
    
    const results = await Promise.allSettled(checks);
    
    // Analyze results and trigger alerts
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.analyzeMetrics(result.value);
      } else {
        console.error(`Check ${index} failed:`, result.reason);
      }
    });
    
    // Attempt auto-recovery if needed
    await this.attemptAutoRecovery();
    
    // Log current status
    this.logStatus();
  }

  async checkCPU() {
    return new Promise((resolve, reject) => {
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = ((total - idle) / total) * 100;
      
      this.metrics.cpu.push({
        timestamp: Date.now(),
        usage: parseFloat(usage.toFixed(2)),
        cores: cpus.length
      });
      
      resolve({ usage, cores: cpus.length });
    });
  }

  async checkMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;
    
    this.metrics.memory.push({
      timestamp: Date.now(),
      usage: parseFloat(usage.toFixed(2)),
      total: this.formatBytes(total),
      used: this.formatBytes(used),
      free: this.formatBytes(free)
    });
    
    return { usage, total, used, free };
  }

  async checkDisk() {
    return new Promise((resolve, reject) => {
      exec('df -h /', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          const usage = parseInt(parts[4].replace('%', ''));
          
          this.metrics.disk.push({
            timestamp: Date.now(),
            usage: usage,
            total: parts[1],
            used: parts[2],
            available: parts[3]
          });
          
          resolve({ usage, total: parts[1], used: parts[2], available: parts[3] });
        } else {
          reject(new Error('Could not parse disk usage'));
        }
      });
    });
  }

  async checkNetwork() {
    return new Promise((resolve, reject) => {
      exec('netstat -i', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.trim().split('\n');
        const interfaces = [];
        
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 10) {
            interfaces.push({
              name: parts[0],
              mtu: parts[1],
              rx_ok: parseInt(parts[2]),
              rx_err: parseInt(parts[3]),
              rx_drp: parseInt(parts[4]),
              rx_ovr: parseInt(parts[5]),
              tx_ok: parseInt(parts[6]),
              tx_err: parseInt(parts[7]),
              tx_drp: parseInt(parts[8]),
              tx_ovr: parseInt(parts[9])
            });
          }
        }
        
        resolve({ interfaces });
      });
    });
  }

  async checkProcesses() {
    return new Promise((resolve, reject) => {
      exec('ps aux', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        const lines = stdout.trim().split('\n');
        const processes = [];
        
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 11) {
            processes.push({
              user: parts[0],
              pid: parseInt(parts[1]),
              cpu: parseFloat(parts[2]),
              mem: parseFloat(parts[3]),
              command: parts.slice(10).join(' ')
            });
          }
        }
        
        // Filter for our application processes
        const appProcesses = processes.filter(p => 
          p.command.includes('node') || 
          p.command.includes('nginx') || 
          p.command.includes('mongod') || 
          p.command.includes('redis')
        );
        
        resolve({ total: processes.length, appProcesses });
      });
    });
  }

  async checkServices() {
    for (const service of this.config.services) {
      try {
        let isHealthy = false;
        
        if (service.command) {
          isHealthy = await this.checkServiceCommand(service.command);
        } else if (service.port) {
          isHealthy = await this.checkServicePort(service.port);
        }
        
        if (!isHealthy) {
          this.triggerAlert('SERVICE_DOWN', {
            service: service.name,
            time: new Date().toISOString()
          });
          
          // Attempt to restart
          await this.restartService(service);
        }
      } catch (error) {
        console.error(`Error checking service ${service.name}:`, error);
      }
    }
  }

  async checkServiceCommand(command) {
    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        resolve(!error);
      });
    });
  }

  async checkServicePort(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(2000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, 'localhost');
    });
  }

  async restartService(service) {
    console.log(`Attempting to restart service: ${service.name}`);
    
    try {
      await this.executeCommand(service.restart);
      
      this.recoveryActions.push({
        action: 'service_restart',
        service: service.name,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      console.log(`Service ${service.name} restarted successfully`);
      
      // Wait and verify
      setTimeout(async () => {
        let isHealthy = false;
        if (service.command) {
          isHealthy = await this.checkServiceCommand(service.command);
        } else if (service.port) {
          isHealthy = await this.checkServicePort(service.port);
        }
        
        if (!isHealthy) {
          this.triggerAlert('SERVICE_RESTART_FAILED', {
            service: service.name,
            time: new Date().toISOString()
          });
        }
      }, 10000);
      
    } catch (error) {
      console.error(`Failed to restart service ${service.name}:`, error);
      
      this.recoveryActions.push({
        action: 'service_restart',
        service: service.name,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
  }

  async checkEndpoints() {
    for (const endpoint of this.config.endpoints) {
      try {
        const startTime = performance.now();
        
        const response = await axios.get(endpoint.url, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        const responseTime = performance.now() - startTime;
        
        // Store metric
        if (!this.metrics.responseTimes[endpoint.name]) {
          this.metrics.responseTimes[endpoint.name] = [];
        }
        
        this.metrics.responseTimes[endpoint.name].push({
          timestamp: Date.now(),
          time: responseTime,
          status: response.status
        });
        
        // Check response time
        if (responseTime > this.config.alertThresholds.responseTime) {
          this.triggerAlert('HIGH_RESPONSE_TIME', {
            endpoint: endpoint.name,
            responseTime: responseTime,
            threshold: this.config.alertThresholds.responseTime
          });
        }
        
        // Check status code
        if (response.status >= 400) {
          this.triggerAlert('ENDPOINT_ERROR', {
            endpoint: endpoint.name,
            status: response.status,
            time: new Date().toISOString()
          });
        }
        
      } catch (error) {
        console.error(`Endpoint ${endpoint.name} check failed:`, error.message);
        
        // Track error
        if (!this.metrics.errors[endpoint.name]) {
          this.metrics.errors[endpoint.name] = [];
        }
        
        this.metrics.errors[endpoint.name].push({
          timestamp: Date.now(),
          error: error.message
        });
        
        this.triggerAlert('ENDPOINT_DOWN', {
          endpoint: endpoint.name,
          error: error.message,
          time: new Date().toISOString()
        });
      }
    }
  }

  analyzeMetrics(metrics) {
    // Check CPU
    if (metrics.usage && metrics.usage > this.config.alertThresholds.cpu) {
      this.triggerAlert('HIGH_CPU', {
        usage: metrics.usage,
        threshold: this.config.alertThresholds.cpu,
        time: new Date().toISOString()
      });
    }
    
    // Check Memory
    if (metrics.usage && metrics.usage > this.config.alertThresholds.memory) {
      this.triggerAlert('HIGH_MEMORY', {
        usage: metrics.usage,
        threshold: this.config.alertThresholds.memory,
        time: new Date().toISOString()
      });
      
      // Attempt memory cleanup
      this.cleanupMemory();
    }
    
    // Check Disk
    if (metrics.usage && metrics.usage > this.config.alertThresholds.disk) {
      this.triggerAlert('HIGH_DISK', {
        usage: metrics.usage,
        threshold: this.config.alertThresholds.disk,
        time: new Date().toISOString()
      });
      
      // Attempt disk cleanup
      this.cleanupDisk();
    }
  }

  triggerAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      severity: this.getAlertSeverity(type),
      data: data,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Log alert
    console.log(`ALERT: ${type} - ${JSON.stringify(data)}`);
    
    // Send notification (email, slack, etc.)
    this.sendAlertNotification(alert);
    
    return alert;
  }

  getAlertSeverity(type) {
    const severityMap = {
      'HIGH_CPU': 'warning',
      'HIGH_MEMORY': 'warning',
      'HIGH_DISK': 'critical',
      'SERVICE_DOWN': 'critical',
      'SERVICE_RESTART_FAILED': 'critical',
      'ENDPOINT_DOWN': 'critical',
      'ENDPOINT_ERROR': 'warning',
      'HIGH_RESPONSE_TIME': 'warning'
    };
    
    return severityMap[type] || 'info';
  }

  async sendAlertNotification(alert) {
    // Implement notification logic (email, SMS, Slack, etc.)
    console.log(`Sending notification for alert: ${alert.id}`);
    
    // Example: Send email
    // await this.sendEmailAlert(alert);
    
    // Example: Send Slack message
    // await this.sendSlackAlert(alert);
    
    // For now, just log
    const notification = {
      alertId: alert.id,
      type: alert.type,
      sent: new Date().toISOString(),
      method: 'console'
    };
    
    return notification;
  }

  async attemptAutoRecovery() {
    // Check for critical alerts that need immediate recovery
    const criticalAlerts = this.alerts.filter(a => 
      a.severity === 'critical' && 
      !a.acknowledged &&
      Date.now() - new Date(a.timestamp).getTime() > 300000 // 5 minutes old
    );
    
    for (const alert of criticalAlerts) {
      switch (alert.type) {
        case 'HIGH_DISK':
          await this.cleanupDisk();
          break;
          
        case 'HIGH_MEMORY':
          await this.cleanupMemory();
          break;
          
        case 'SERVICE_DOWN':
          // Service restart already attempted in checkServices
          break;
          
        case 'ENDPOINT_DOWN':
          await this.restartApplication();
          break;
      }
      
      // Mark as acknowledged after recovery attempt
      alert.acknowledged = true;
    }
  }

  async cleanupMemory() {
    console.log('Attempting memory cleanup...');
    
    try {
      // Clear Node.js cache (if applicable)
      if (typeof global.gc === 'function') {
        global.gc();
      }
      
      // Clear application-specific caches
      const cacheDir = path.join(__dirname, '..', 'cache');
      if (fs.existsSync(cacheDir)) {
        exec(`rm -rf ${cacheDir}/*`, (error) => {
          if (!error) {
            console.log('Cache cleared successfully');
          }
        });
      }
      
      this.recoveryActions.push({
        action: 'memory_cleanup',
        timestamp: new Date().toISOString(),
        success: true
      });
      
    } catch (error) {
      console.error('Memory cleanup failed:', error);
      
      this.recoveryActions.push({
        action: 'memory_cleanup',
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
  }

  async cleanupDisk() {
    console.log('Attempting disk cleanup...');
    
    try {
      const cleanupActions = [];
      
      // Clean log files older than 7 days
      const logDir = path.join(__dirname, '..', 'logs');
      if (fs.existsSync(logDir)) {
        exec(`find ${logDir} -name "*.log" -mtime +7 -delete`, (error) => {
          if (!error) cleanupActions.push('logs_cleaned');
        });
      }
      
      // Clean temporary files
      const tempDir = '/tmp';
      exec(`find ${tempDir} -name "jobai_*" -mtime +1 -delete`, (error) => {
        if (!error) cleanupActions.push('temp_files_cleaned');
      });
      
      // Clean old backups (keep last 7 days)
      const backupDir = path.join(__dirname, '..', 'backups');
      if (fs.existsSync(backupDir)) {
        exec(`find ${backupDir} -name "*.tar.gz" -mtime +7 -delete`, (error) => {
          if (!error) cleanupActions.push('old_backups_cleaned');
        });
      }
      
      // Clear npm cache
      exec('npm cache clean --force', (error) => {
        if (!error) cleanupActions.push('npm_cache_cleaned');
      });
      
      this.recoveryActions.push({
        action: 'disk_cleanup',
        timestamp: new Date().toISOString(),
        actions: cleanupActions,
        success: cleanupActions.length > 0
      });
      
    } catch (error) {
      console.error('Disk cleanup failed:', error);
      
      this.recoveryActions.push({
        action: 'disk_cleanup',
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
  }

  async restartApplication() {
    console.log('Attempting application restart...');
    
    try {
      // Stop all services
      await this.executeCommand('pm2 stop all');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Start all services
      await this.executeCommand('pm2 start all');
      
      this.recoveryActions.push({
        action: 'application_restart',
        timestamp: new Date().toISOString(),
        success: true
      });
      
      console.log('Application restarted successfully');
      
    } catch (error) {
      console.error('Application restart failed:', error);
      
      this.recoveryActions.push({
        action: 'application_restart',
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  cleanupOldMetrics() {
    const oneHourAgo = Date.now() - 3600000;
    const oneDayAgo = Date.now() - 86400000;
    
    // Clean CPU metrics older than 1 hour
    this.metrics.cpu = this.metrics.cpu.filter(m => m.timestamp > oneHourAgo);
    
    // Clean memory metrics older than 1 hour
    this.metrics.memory = this.metrics.memory.filter(m => m.timestamp > oneHourAgo);
    
    // Clean disk metrics older than 1 hour
    this.metrics.disk = this.metrics.disk.filter(m => m.timestamp > oneHourAgo);
    
    // Clean old alerts (keep last 24 hours)
    this.alerts = this.alerts.filter(a => new Date(a.timestamp).getTime() > oneDayAgo);
    
    // Clean old recovery actions (keep last 7 days)
    const sevenDaysAgo = Date.now() - 604800000;
    this.recoveryActions = this.recoveryActions.filter(r => new Date(r.timestamp).getTime() > sevenDaysAgo);
  }

  logStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: this.formatUptime(Date.now() - this.metrics.uptime),
      alerts: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        warning: this.alerts.filter(a => a.severity === 'warning').length
      },
      recoveryActions: this.recoveryActions.length,
      system: {
        cpu: this.metrics.cpu.length > 0 ? this.metrics.cpu[this.metrics.cpu.length - 1].usage : 0,
        memory: this.metrics.memory.length > 0 ? this.metrics.memory[this.metrics.memory.length - 1].usage : 0,
        disk: this.metrics.disk.length > 0 ? this.metrics.disk[this.metrics.disk.length - 1].usage : 0
      }
    };
    
    // Log to file
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `health_${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(status) + '\n');
    
    return status;
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getHealthReport() {
    const now = Date.now();
    const lastHour = now - 3600000;
    
    // Calculate averages for last hour
    const recentCPU = this.metrics.cpu.filter(m => m.timestamp > lastHour);
    const avgCPU = recentCPU.length > 0 
      ? recentCPU.reduce((sum, m) => sum + m.usage, 0) / recentCPU.length 
      : 0;
    
    const recentMemory = this.metrics.memory.filter(m => m.timestamp > lastHour);
    const avgMemory = recentMemory.length > 0
      ? recentMemory.reduce((sum, m) => sum + m.usage, 0) / recentMemory.length
      : 0;
    
    const recentDisk = this.metrics.disk.filter(m => m.timestamp > lastHour);
    const avgDisk = recentDisk.length > 0
      ? recentDisk.reduce((sum, m) => sum + m.usage, 0) / recentDisk.length
      : 0;
    
    // Calculate endpoint availability
    const endpointAvailability = {};
    for (const [name, responses] of Object.entries(this.metrics.responseTimes)) {
      const recentResponses = responses.filter(r => r.timestamp > lastHour);
      if (recentResponses.length > 0) {
        const successful = recentResponses.filter(r => r.status < 400).length;
        endpointAvailability[name] = (successful / recentResponses.length) * 100;
      }
    }
    
    const report = {
      generated: new Date().toISOString(),
      system: {
        cpu: {
          current: this.metrics.cpu.length > 0 ? this.metrics.cpu[this.metrics.cpu.length - 1].usage : 0,
          average: parseFloat(avgCPU.toFixed(2)),
          threshold: this.config.alertThresholds.cpu
        },
        memory: {
          current: this.metrics.memory.length > 0 ? this.metrics.memory[this.metrics.memory.length - 1].usage : 0,
          average: parseFloat(avgMemory.toFixed(2)),
          threshold: this.config.alertThresholds.memory
        },
        disk: {
          current: this.metrics.disk.length > 0 ? this.metrics.disk[this.metrics.disk.length - 1].usage : 0,
          average: parseFloat(avgDisk.toFixed(2)),
          threshold: this.config.alertThresholds.disk
        }
      },
      services: {},
      endpoints: endpointAvailability,
      alerts: {
        total: this.alerts.length,
        lastHour: this.alerts.filter(a => new Date(a.timestamp).getTime() > lastHour).length,
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        unacknowledged: this.alerts.filter(a => !a.acknowledged).length
      },
      recovery: {
        totalActions: this.recoveryActions.length,
        lastHour: this.recoveryActions.filter(r => new Date(r.timestamp).getTime() > lastHour).length,
        successful: this.recoveryActions.filter(r => r.success).length
      },
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check CPU
    const recentCPU = this.metrics.cpu.slice(-10); // Last 10 readings
    const avgCPU = recentCPU.length > 0 
      ? recentCPU.reduce((sum, m) => sum + m.usage, 0) / recentCPU.length 
      : 0;
    
    if (avgCPU > 70) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'High CPU usage detected. Consider optimizing code or scaling resources.',
        action: 'Review application performance and consider adding more CPU resources.'
      });
    }
    
    // Check Memory
    const recentMemory = this.metrics.memory.slice(-10);
    const avgMemory = recentMemory.length > 0
      ? recentMemory.reduce((sum, m) => sum + m.usage, 0) / recentMemory.length
      : 0;
    
    if (avgMemory > 75) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'High memory usage detected. Check for memory leaks.',
        action: 'Run memory profiling and optimize application memory usage.'
      });
    }
    
    // Check Disk
    const recentDisk = this.metrics.disk.slice(-10);
    const avgDisk = recentDisk.length > 0
      ? recentDisk.reduce((sum, m) => sum + m.usage, 0) / recentDisk.length
      : 0;
    
    if (avgDisk > 85) {
      recommendations.push({
        type: 'storage',
        priority: 'critical',
        message: 'Disk space running low. Cleanup required.',
        action: 'Implement automatic cleanup of old logs and temporary files.'
      });
    }
    
    // Check alerts
    const recentAlerts = this.alerts.filter(a => 
      Date.now() - new Date(a.timestamp).getTime() < 3600000
    );
    
    if (recentAlerts.length > 5) {
      recommendations.push({
        type: 'stability',
        priority: 'high',
        message: 'High number of recent alerts. System stability may be compromised.',
        action: 'Review alert patterns and address root causes.'
      });
    }
    
    return recommendations;
  }
}

module.exports = HealthMonitor;
