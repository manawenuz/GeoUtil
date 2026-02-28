# Docker Deployment Guide

This guide covers running the Georgia Utility Monitor using Docker and Docker Compose.

## Prerequisites

- Docker 20.10 or later
- Docker Compose 2.0 or later

## Quick Start

### Local Development (Recommended)

For local development, run only the database services and run Next.js locally:

```bash
# Start Redis and Postgres
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run migrations
npm run migrate

# Start the development server
npm run dev
```

The app will be available at http://localhost:3000

### Full Stack with Docker

To run the complete stack including the app in Docker:

```bash
# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

The app will be available at http://localhost:3000

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Storage Configuration
STORAGE_BACKEND=postgres

# Authentication (Required)
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Security (Required)
ENCRYPTION_KEY=your-32-character-encryption-key
CRON_SECRET=your-cron-secret

# Notifications (Optional)
NTFY_SERVER_URL=https://ntfy.sh

# Scheduler (Optional)
SCHEDULER_INTERVAL_HOURS=72
```

### Generate Secrets

Generate secure random secrets:

```bash
# Generate encryption key
openssl rand -base64 32

# Generate NextAuth secret
openssl rand -base64 32

# Generate cron secret
openssl rand -base64 32
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and Client Secret to your `.env` file

## Docker Compose Files

### docker-compose.yml (Production)

Full stack configuration including:
- Redis (port 6379)
- Postgres (port 5432)
- App (port 3000)

```bash
docker-compose up -d
```

### docker-compose.dev.yml (Development)

Only database services for local development:
- Redis (port 6379)
- Postgres (port 5432)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Service Management

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart app
```

## Database Access

### Postgres

Connect to Postgres:

```bash
# Using docker exec
docker exec -it utility-monitor-postgres psql -U dev -d utility_monitor

# Using psql from host
psql -h localhost -p 5432 -U dev -d utility_monitor
```

### Redis

Connect to Redis:

```bash
# Using docker exec
docker exec -it utility-monitor-redis redis-cli

# Using redis-cli from host
redis-cli -h localhost -p 6379
```

## Migrations

Migrations run automatically when Postgres starts via the init scripts in `migrations/postgres/`.

To run migrations manually:

```bash
# From host
npm run migrate

# From Docker container
docker-compose exec app npm run migrate
```

## Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Test app health endpoint
curl http://localhost:3000/api/health
```

## Troubleshooting

### App Won't Start

1. Check logs:
   ```bash
   docker-compose logs app
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Ensure databases are healthy:
   ```bash
   docker-compose ps
   ```

### Database Connection Issues

1. Check database health:
   ```bash
   docker-compose ps postgres
   docker-compose logs postgres
   ```

2. Verify connection from app:
   ```bash
   docker-compose exec app sh
   # Inside container:
   wget -O- http://postgres:5432
   ```

### Redis Connection Issues

1. Check Redis health:
   ```bash
   docker-compose ps redis
   docker-compose logs redis
   ```

2. Test Redis connection:
   ```bash
   docker exec -it utility-monitor-redis redis-cli ping
   ```

### Port Conflicts

If ports are already in use, modify the port mappings in `docker-compose.yml`:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Use 5433 on host instead of 5432
```

## Production Deployment

### Build Production Image

```bash
# Build the image
docker build -t georgia-utility-monitor:latest .

# Tag for registry
docker tag georgia-utility-monitor:latest your-registry/georgia-utility-monitor:latest

# Push to registry
docker push your-registry/georgia-utility-monitor:latest
```

### Production Environment Variables

Update `.env` for production:

```bash
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
STORAGE_BACKEND=postgres

# Use strong secrets
ENCRYPTION_KEY=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -base64 32)
```

### Production Considerations

1. **Use external databases**: Don't run databases in Docker for production
2. **Enable SSL**: Configure HTTPS with reverse proxy (nginx, Caddy)
3. **Backup data**: Regular backups of Postgres and Redis
4. **Monitor logs**: Use logging aggregation (ELK, Loki)
5. **Resource limits**: Set memory and CPU limits in docker-compose.yml
6. **Secrets management**: Use Docker secrets or external secret managers

### Example Production Setup with External Databases

```yaml
services:
  app:
    image: your-registry/georgia-utility-monitor:latest
    environment:
      STORAGE_BACKEND: postgres
      POSTGRES_HOST: your-postgres-host.com
      POSTGRES_PORT: 5432
      POSTGRES_DB: utility_monitor
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_URL: redis://your-redis-host.com:6379
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Storage Backend Options

### Postgres (Recommended for Production)

```bash
STORAGE_BACKEND=postgres
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=utility_monitor
POSTGRES_USER=dev
POSTGRES_PASSWORD=devpassword
```

### Redis

```bash
STORAGE_BACKEND=redis
REDIS_URL=redis://redis:6379
```

### SQLite (Development Only)

```bash
STORAGE_BACKEND=sqlite
SQLITE_PATH=/app/data/utility_monitor.db
```

## Backup and Restore

### Postgres Backup

```bash
# Backup
docker exec utility-monitor-postgres pg_dump -U dev utility_monitor > backup.sql

# Restore
docker exec -i utility-monitor-postgres psql -U dev utility_monitor < backup.sql
```

### Redis Backup

```bash
# Backup (creates dump.rdb)
docker exec utility-monitor-redis redis-cli SAVE

# Copy backup file
docker cp utility-monitor-redis:/data/dump.rdb ./redis-backup.rdb

# Restore (copy file and restart)
docker cp ./redis-backup.rdb utility-monitor-redis:/data/dump.rdb
docker-compose restart redis
```

## Performance Tuning

### Postgres

Edit `docker-compose.yml` to add Postgres configuration:

```yaml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

### Redis

Edit `docker-compose.yml` to add Redis configuration:

```yaml
redis:
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

## Monitoring

### Container Stats

```bash
# Real-time stats
docker stats

# Specific container
docker stats utility-monitor-app
```

### Health Check Status

```bash
# Check all services
docker-compose ps

# Inspect specific service
docker inspect utility-monitor-app | grep -A 10 Health
```

## Cleanup

### Remove Stopped Containers

```bash
docker-compose down
```

### Remove Volumes (WARNING: Deletes Data)

```bash
docker-compose down -v
```

### Remove Images

```bash
docker rmi georgia-utility-monitor:latest
```

### Full Cleanup

```bash
# Stop and remove everything
docker-compose down -v --rmi all

# Remove unused Docker resources
docker system prune -a
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Postgres Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
