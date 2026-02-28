# Georgia Utility Monitor - Setup Guide

## Project Structure

```
georgia-utility-monitor/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes (to be implemented)
│   ├── layout.tsx           # Root layout with PWA metadata
│   ├── page.tsx             # Home page
│   └── globals.css          # Global styles with Tailwind
├── components/              # React components (to be implemented)
├── lib/                     # Core business logic
│   ├── storage/            # Storage adapters (Redis, Postgres, SQLite)
│   ├── providers/          # Utility provider adapters
│   ├── services/           # Business services
│   └── types/              # TypeScript type definitions
├── migrations/              # Database migrations
│   ├── postgres/           # PostgreSQL migration scripts
│   ├── redis/              # Redis migration scripts
│   └── sqlite/             # SQLite migration scripts
├── public/                  # Static assets (PWA manifest, icons)
├── scripts/                 # Utility scripts
│   └── migrate.js          # Database migration runner
├── .env.example            # Environment variable template
├── .env.local              # Local environment variables (git-ignored)
├── docker-compose.yml      # Local development services
├── Dockerfile              # Production container image
├── jest.config.js          # Jest testing configuration
├── next.config.js          # Next.js configuration
├── package.json            # Dependencies and scripts
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── vercel.json             # Vercel deployment configuration
```

## Technology Stack

### Frontend
- **Next.js 14+**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **React 18**: UI library

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Axios**: HTTP client for provider requests
- **Cheerio**: HTML parsing for provider responses
- **node-cron**: Scheduling for local/VPS deployments

### Storage
- **PostgreSQL**: Relational database (via pg)
- **Redis**: In-memory data store (via @upstash/redis)
- **SQLite**: Embedded database (via better-sqlite3)

### Security
- **jsonwebtoken**: JWT authentication
- **@upstash/ratelimit**: Rate limiting
- **crypto**: Built-in encryption (AES-256-GCM)

### Testing
- **Jest**: Test runner
- **ts-jest**: TypeScript support for Jest
- **fast-check**: Property-based testing

## Environment Configuration

### Required Variables

```bash
# Storage Backend Selection
STORAGE_BACKEND=postgres  # Options: postgres, redis, sqlite

# Database Connection (based on STORAGE_BACKEND)
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_URL=redis://host:6379
SQLITE_PATH=./data/utility_monitor.db

# Security Keys (MUST be changed in production)
ENCRYPTION_KEY=your-32-character-encryption-key-here
JWT_SECRET=your-jwt-secret-here
CRON_SECRET=your-cron-secret-here

# Notification Configuration
NTFY_SERVER_URL=https://ntfy.sh

# Scheduler Configuration
SCHEDULER_TYPE=node-cron  # Options: node-cron, vercel-cron
SCHEDULER_INTERVAL_HOURS=72

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Vercel-Specific Variables

When deploying to Vercel, these are automatically provided:

```bash
POSTGRES_URL=<from Vercel Postgres>
POSTGRES_PRISMA_URL=<from Vercel Postgres>
POSTGRES_URL_NON_POOLING=<from Vercel Postgres>
KV_URL=<from Vercel KV>
KV_REST_API_URL=<from Vercel KV>
KV_REST_API_TOKEN=<from Vercel KV>
```

## Development Workflow

### 1. Initial Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your configuration
nano .env.local
```

### 2. Start Local Services

```bash
# Start Redis and PostgreSQL with Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Run Migrations

```bash
# Run database migrations
npm run migrate

# This will:
# - Create necessary tables in PostgreSQL
# - Set up migration tracking
# - Initialize schema
```

### 4. Development Server

```bash
# Start Next.js development server
npm run dev

# Server will be available at http://localhost:3000
```

### 5. Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### 6. Build for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Docker Commands

### Local Development

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]
```

### Production Docker

```bash
# Build production image
docker build -t georgia-utility-monitor .

# Run production container
docker run -p 3000:3000 \
  --env-file .env.production \
  georgia-utility-monitor

# Run with Docker Compose (production)
docker-compose -f docker-compose.prod.yml up -d
```

## Database Management

### PostgreSQL

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U dev -d utility_monitor

# Common commands:
\dt              # List tables
\d table_name    # Describe table
\q               # Quit

# Backup database
docker-compose exec postgres pg_dump -U dev utility_monitor > backup.sql

# Restore database
docker-compose exec -T postgres psql -U dev utility_monitor < backup.sql
```

### Redis

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Common commands:
KEYS *           # List all keys
GET key          # Get value
DEL key          # Delete key
FLUSHALL         # Clear all data (careful!)
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env.local
PORT=3001
```

### Docker Issues

```bash
# Clean up Docker
docker-compose down -v
docker system prune -a

# Rebuild containers
docker-compose up -d --build
```

### Migration Issues

```bash
# Reset migrations (development only!)
docker-compose exec postgres psql -U dev -d utility_monitor -c "DROP TABLE IF EXISTS migrations CASCADE;"

# Re-run migrations
npm run migrate
```

### TypeScript Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

## Next Steps

After completing Task 1 (Project Setup), the next tasks are:

1. **Task 2**: Storage adapter interface and base implementation
2. **Task 3**: Implement Redis storage adapter
3. **Task 4**: Implement Postgres storage adapter
4. **Task 5**: Implement SQLite storage adapter

See `tasks.md` in `.kiro/specs/georgia-utility-monitor/` for the complete implementation plan.

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [fast-check Documentation](https://fast-check.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/docs/)
