#!/bin/bash

# Georgia Utility Monitor - Docker Quick Start Script

set -e

echo "🚀 Georgia Utility Monitor - Docker Setup"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your configuration before continuing!"
    echo ""
    echo "Required variables:"
    echo "  - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
    echo "  - ENCRYPTION_KEY (generate with: openssl rand -base64 32)"
    echo "  - CRON_SECRET (generate with: openssl rand -base64 32)"
    echo "  - GOOGLE_CLIENT_ID (from Google Cloud Console)"
    echo "  - GOOGLE_CLIENT_SECRET (from Google Cloud Console)"
    echo ""
    read -p "Press Enter after editing .env file to continue..."
fi

# Check for required environment variables
source .env

MISSING_VARS=()

if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "your-nextauth-secret-here-change-this" ]; then
    MISSING_VARS+=("NEXTAUTH_SECRET")
fi

if [ -z "$ENCRYPTION_KEY" ] || [ "$ENCRYPTION_KEY" = "your-32-character-encryption-key-here-change-this" ]; then
    MISSING_VARS+=("ENCRYPTION_KEY")
fi

if [ -z "$CRON_SECRET" ] || [ "$CRON_SECRET" = "your-cron-secret-here-change-this" ]; then
    MISSING_VARS+=("CRON_SECRET")
fi

if [ -z "$GOOGLE_CLIENT_ID" ] || [ "$GOOGLE_CLIENT_ID" = "your-google-client-id.apps.googleusercontent.com" ]; then
    MISSING_VARS+=("GOOGLE_CLIENT_ID")
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ] || [ "$GOOGLE_CLIENT_SECRET" = "your-google-client-secret" ]; then
    MISSING_VARS+=("GOOGLE_CLIENT_SECRET")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ Missing or default values for required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit .env file and set these variables."
    echo ""
    echo "Generate secrets with:"
    echo "  openssl rand -base64 32"
    echo ""
    echo "Get Google OAuth credentials from:"
    echo "  https://console.cloud.google.com/apis/credentials"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Ask which mode to run
echo "Select deployment mode:"
echo "  1) Development (databases only, run app with 'npm run dev')"
echo "  2) Production (full stack with Docker)"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo ""
        echo "🔧 Starting development environment..."
        docker-compose -f docker-compose.dev.yml up -d
        
        echo ""
        echo "✅ Development databases started!"
        echo ""
        echo "Next steps:"
        echo "  1. Install dependencies: npm install"
        echo "  2. Run migrations: npm run migrate"
        echo "  3. Start dev server: npm run dev"
        echo "  4. Open http://localhost:3000"
        echo ""
        echo "To stop databases: docker-compose -f docker-compose.dev.yml down"
        ;;
    2)
        echo ""
        echo "🏗️  Building and starting production environment..."
        docker-compose up -d --build
        
        echo ""
        echo "⏳ Waiting for services to be healthy..."
        sleep 5
        
        # Wait for health checks
        for i in {1..30}; do
            if docker-compose ps | grep -q "healthy"; then
                echo "✅ Services are healthy!"
                break
            fi
            echo "   Waiting... ($i/30)"
            sleep 2
        done
        
        echo ""
        echo "✅ Production stack started!"
        echo ""
        echo "Services:"
        echo "  - App: http://localhost:3000"
        echo "  - Postgres: localhost:5432"
        echo "  - Redis: localhost:6379"
        echo ""
        echo "Useful commands:"
        echo "  - View logs: docker-compose logs -f"
        echo "  - Stop services: docker-compose down"
        echo "  - Restart app: docker-compose restart app"
        echo ""
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo "📚 For more information, see DOCKER.md"
