#!/bin/bash

# On-Premise Deployment Script for Craftsman Dynamic Backend Platform
# This script deploys the platform using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="backups"
LOG_DIR="logs"
UPLOAD_DIR="uploads"

echo -e "${BLUE}🚀 Craftsman Dynamic Backend Platform - On-Premise Deployment${NC}"
echo "=================================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Docker is running
check_docker() {
    print_info "Checking Docker installation..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_status "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_info "Checking Docker Compose..."
    if ! docker-compose version > /dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose and try again."
        exit 1
    fi
    print_status "Docker Compose is available"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p $BACKUP_DIR
    mkdir -p $LOG_DIR
    mkdir -p $UPLOAD_DIR
    mkdir -p nginx/ssl
    
    print_status "Directories created"
}

# Generate self-signed SSL certificate (for development/testing)
generate_ssl_cert() {
    print_info "Generating self-signed SSL certificate..."
    
    if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
        openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        print_status "SSL certificate generated"
    else
        print_info "SSL certificate already exists"
    fi
}

# Backup existing data (if any)
backup_existing() {
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        print_warning "Existing backup directory found. Creating timestamped backup..."
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        cp -r $BACKUP_DIR "${BACKUP_DIR}_${TIMESTAMP}"
        print_status "Existing backup preserved as ${BACKUP_DIR}_${TIMESTAMP}"
    fi
}

# Stop existing containers
stop_containers() {
    print_info "Stopping existing containers..."
    docker-compose -f $COMPOSE_FILE down --remove-orphans || true
    print_status "Existing containers stopped"
}

# Build and start services
deploy_services() {
    print_info "Building and starting services..."
    
    # Build the application
    print_info "Building application image..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    
    # Start services
    print_info "Starting services..."
    docker-compose -f $COMPOSE_FILE up -d
    
    print_status "Services started"
}

# Wait for services to be ready
wait_for_services() {
    print_info "Waiting for services to be ready..."
    
    # Wait for MongoDB
    print_info "Waiting for MongoDB..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose -f $COMPOSE_FILE exec -T mongo mongosh --eval "rs.status()" > /dev/null 2>&1; then
            print_status "MongoDB is ready"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "MongoDB failed to start within timeout"
        exit 1
    fi
    
    # Wait for Redis
    print_info "Waiting for Redis..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
            print_status "Redis is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Redis failed to start within timeout"
        exit 1
    fi
    
    # Wait for application
    print_info "Waiting for application..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:5000/health > /dev/null 2>&1; then
            print_status "Application is ready"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Application failed to start within timeout"
        exit 1
    fi
}

# Show service status
show_status() {
    print_info "Service status:"
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    print_info "Application URLs:"
    echo "  - HTTP:  http://localhost"
    echo "  - HTTPS: https://localhost"
    echo "  - API:   https://localhost/api"
    echo "  - Health: https://localhost/health"
}

# Main deployment function
main() {
    echo "Starting deployment process..."
    
    check_docker
    check_docker_compose
    create_directories
    generate_ssl_cert
    backup_existing
    stop_containers
    deploy_services
    wait_for_services
    show_status
    
    echo ""
    print_status "🎉 Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Access the application at https://localhost"
    echo "2. Check logs: docker-compose logs -f"
    echo "3. Monitor health: curl https://localhost/health"
    echo "4. Stop services: docker-compose down"
    echo ""
    echo "For production use, replace the self-signed SSL certificate with a valid one."
}

# Run main function
main "$@"
