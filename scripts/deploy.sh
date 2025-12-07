#!/bin/bash

# JobAI South Africa - Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting JobAI South Africa Deployment${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Check required tools
echo -e "${YELLOW}🔧 Checking required tools...${NC}"

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ $1 found${NC}"
}

check_command docker
check_command docker-compose
check_command git
check_command node
check_command npm

# Backup current deployment
echo -e "${YELLOW}📦 Creating backup...${NC}"
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

if [ -d "uploads" ]; then
    cp -r uploads $BACKUP_DIR/
fi

if [ -d "logs" ]; then
    cp -r logs $BACKUP_DIR/
fi

if [ -f "database/dump.gz" ]; then
    cp database/dump.gz $BACKUP_DIR/
fi

echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"

# Pull latest code
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
git pull origin main
echo -e "${GREEN}✅ Code updated${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"

echo "Installing backend dependencies..."
cd backend
npm ci --production
cd ..

echo "Installing frontend dependencies..."
cd frontend
npm ci --production
npm run build
cd ..

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build Docker images
echo -e "${YELLOW}🐳 Building Docker images...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✅ Docker images built${NC}"

# Stop and remove old containers
echo -e "${YELLOW}🛑 Stopping old containers...${NC}"
docker-compose down --remove-orphans
echo -e "${GREEN}✅ Old containers stopped${NC}"

# Start new containers
echo -e "${YELLOW}🚀 Starting new containers...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ Containers started${NC}"

# Run database migrations
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
sleep 10  # Wait for MongoDB to start

docker-compose exec backend node scripts/migrate.js
echo -e "${GREEN}✅ Database migrations completed${NC}"

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"

check_service() {
    SERVICE=$1
    URL=$2
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    until curl -f $URL > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
        RETRY_COUNT=$((RETRY_COUNT+1))
        echo "Waiting for $SERVICE... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ $SERVICE failed to start${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $SERVICE is healthy${NC}"
        return 0
    fi
}

check_service "Backend API" "http://localhost:5000/health"
check_service "Frontend" "http://localhost:3000"
check_service "Grafana" "http://localhost:3001"

echo -e "${GREEN}✅ All services are healthy${NC}"

# Initialize monitoring
echo -e "${YELLOW}📊 Initializing monitoring...${NC}"
docker-compose exec backend node scripts/init-monitoring.js
echo -e "${GREEN}✅ Monitoring initialized${NC}"

# Create admin user if not exists
echo -e "${YELLOW}👨‍💼 Creating admin user...${NC}"
docker-compose exec backend node scripts/create-admin.js
echo -e "${GREEN}✅ Admin user created${NC}"

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
docker-compose exec backend npm test
echo -e "${GREEN}✅ Tests passed${NC}"

# Display deployment information
echo -e "\n${GREEN}🎉 Deployment Completed Successfully!${NC}"
echo -e "============================================="
echo -e "Frontend:      http://localhost:3000"
echo -e "Backend API:   http://localhost:5000"
echo -e "Admin Panel:   http://localhost:3000/admin"
echo -e "Grafana:       http://localhost:3001"
echo -e "Flower:        http://localhost:5555"
echo -e "Prometheus:    http://localhost:9090"
echo -e "\n${YELLOW}📈 Check application logs:${NC}"
echo -e "docker-compose logs -f"
echo -e "\n${YELLOW}🔄 Restart services:${NC}"
echo -e "docker-compose restart [service_name]"
echo -e "\n${YELLOW}📊 View metrics:${NC}"
echo -e "Open Grafana at http://localhost:3001"
echo -e "\n${GREEN}✅ Deployment script completed${NC}"
