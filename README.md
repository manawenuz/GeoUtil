# Georgia Utility Monitor

A Progressive Web App (PWA) that automatically monitors utility bills across multiple providers in Georgia. Get push notifications when bills are due, track payment history, and manage all your utility accounts in one place.

## 🌟 Features

- **🔐 Secure Authentication**: Sign in with your Google account
- **🔄 Automated Monitoring**: Checks balances every 72 hours automatically
- **📱 Progressive Web App**: Install on your phone like a native app
- **🔔 Smart Notifications**: Push notifications via ntfy.sh with escalating priority for overdue bills
- **💾 Flexible Storage**: Choose between Redis, Postgres, or SQLite backends
- **🏠 Self-Hostable**: Deploy to Vercel, VPS, or run locally with Docker
- **🔒 Privacy-First**: Your account numbers are encrypted at rest
- **📊 Balance History**: Track your payment patterns over time
- **⚡ Manual Refresh**: Check balances on-demand anytime
- **📤 Import/Export**: Backup and restore your configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or later
- Docker and Docker Compose (for local development)
- Google OAuth credentials ([setup guide](#google-oauth-setup))

### Option 1: Quick Start Script (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd georgia-utility-monitor

# Run the quick start script
./docker-start.sh
```

The script will guide you through:
1. Environment configuration check
2. Choosing development or production mode
3. Starting all required services

### Option 2: Manual Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and set required variables (see [Environment Configuration](#environment-configuration))

3. **Generate secrets**
   ```bash
   # Encryption key (for account numbers and notification URLs)
   openssl rand -base64 32
   
   # NextAuth secret (for session encryption)
   openssl rand -base64 32
   
   # Cron secret (for protecting scheduled job endpoints)
   openssl rand -base64 32
   ```

4. **Start local services**
   ```bash
   # Start Redis and Postgres
   docker-compose -f docker-compose.dev.yml up -d
   ```

5. **Run migrations**
   ```bash
   npm run migrate
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_SECRET` | Secret for session encryption | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your application URL | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |
| `ENCRYPTION_KEY` | Key for encrypting sensitive data | Generate with `openssl rand -base64 32` |
| `CRON_SECRET` | Secret for cron endpoint protection | Generate with `openssl rand -base64 32` |

### Storage Configuration

Choose one storage backend:

**PostgreSQL (Recommended for Production)**
```bash
STORAGE_BACKEND=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/utility_monitor
```

**Redis**
```bash
STORAGE_BACKEND=redis
REDIS_URL=redis://localhost:6379
```

**SQLite (Development Only)**
```bash
STORAGE_BACKEND=sqlite
SQLITE_PATH=./data/utility_monitor.db
```

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NTFY_SERVER_URL` | ntfy.sh server URL (cloud or self-hosted) | `https://ntfy.sh` |
| `SCHEDULER_INTERVAL_HOURS` | How often to check balances | `72` (3 days) |

See `.env.example` for complete configuration options.

## 🔑 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select an existing one
3. Enable the **Google+ API**
4. Navigate to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Configure OAuth consent screen:
   - App name: Georgia Utility Monitor
   - User support email: Your email
   - Scopes: email, profile, openid
6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://your-domain.com/api/auth/callback/google`
7. Copy the **Client ID** and **Client Secret** to your `.env.local` file

For detailed instructions, see [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)

## 📖 Usage

### Adding Utility Accounts

1. Sign in with your Google account
2. Navigate to **Settings** or **Accounts**
3. Click **Add Account**
4. Select your utility provider (Gas, Water, Electricity, Trash)
5. Enter your account number
6. Save

### Configuring Notifications

1. Go to **Notifications** settings
2. Subscribe to a ntfy.sh topic:
   - **Web**: Visit [ntfy.sh](https://ntfy.sh) and create a topic
   - **Mobile**: Install the ntfy app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/app/ntfy/id1625396347))
3. Enter your ntfy.sh topic URL (e.g., `https://ntfy.sh/my-unique-topic`)
4. Optionally configure a self-hosted ntfy.sh server
5. Click **Test Notification** to verify setup

### Manual Balance Check

- Click the **Refresh** button next to any account
- View updated balance and timestamp
- Check overdue status

### Viewing History

- Navigate to **History** page
- View balance changes over time
- See notification history

### Backup & Restore

**Export Configuration:**
1. Go to **Settings**
2. Click **Export Configuration**
3. Save the JSON file

**Import Configuration:**
1. Go to **Settings**
2. Click **Import Configuration**
3. Select your JSON file
4. Review and confirm import

## 🏗️ Project Structure

```
georgia-utility-monitor/
├── app/                      # Next.js App Router
│   ├── api/                 # API routes
│   │   ├── accounts/        # Account management
│   │   ├── balances/        # Balance checking
│   │   ├── notifications/   # Notification config
│   │   ├── config/          # Import/export
│   │   ├── cron/            # Scheduled jobs
│   │   └── health/          # Health checks
│   ├── auth/                # Authentication pages
│   ├── history/             # Balance history page
│   ├── notifications/       # Notifications page
│   ├── settings/            # Settings page
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/              # React components
│   ├── auth/               # Authentication components
│   ├── AccountManagement.tsx
│   ├── BalanceDisplay.tsx
│   ├── ConfigImportExport.tsx
│   ├── ManualRefresh.tsx
│   ├── Navigation.tsx
│   ├── NotificationConfig.tsx
│   └── ServiceWorkerRegistration.tsx
├── lib/                     # Core business logic
│   ├── storage/            # Storage adapters
│   │   ├── types.ts        # Storage interface
│   │   ├── factory.ts      # Adapter factory
│   │   ├── postgres-adapter.ts
│   │   ├── redis-adapter.ts
│   │   └── sqlite-adapter.ts
│   ├── providers/          # Utility provider adapters
│   │   ├── types.ts        # Provider interface
│   │   ├── registry.ts     # Provider registry
│   │   ├── factory.ts      # Provider factory
│   │   └── te-ge-gas-adapter.ts
│   ├── auth.ts             # NextAuth configuration
│   ├── auth-adapter.ts     # NextAuth storage adapter
│   ├── auth-helpers.ts     # Auth utility functions
│   ├── encryption.ts       # Encryption service
│   ├── notification-service.ts
│   ├── scheduler-service.ts
│   ├── init.ts             # App initialization
│   └── services.ts         # Service instances
├── migrations/              # Database migrations
│   ├── postgres/           # PostgreSQL migrations
│   ├── redis/              # Redis migrations
│   └── sqlite/             # SQLite migrations
├── public/                  # Static assets
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   └── icons/              # App icons
├── docs/                    # Documentation
│   ├── AUTHENTICATION.md
│   ├── OAUTH-SCHEMA.md
│   └── SESSION-MANAGEMENT.md
├── .env.example            # Environment template
├── docker-compose.yml      # Production Docker setup
├── docker-compose.dev.yml  # Development Docker setup
├── Dockerfile              # Production container
├── DOCKER.md               # Docker deployment guide
└── README.md               # This file
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.test.ts
```

The project includes:
- **Unit tests**: Test individual functions and components
- **Integration tests**: Test API routes and service interactions
- **Property-based tests**: Test universal properties with fast-check

## 🚢 Deployment

### Docker (Recommended)

See [DOCKER.md](DOCKER.md) for comprehensive Docker deployment guide.

**Quick production deployment:**

```bash
# Configure environment
cp .env.example .env
# Edit .env with production values

# Start full stack
docker-compose up -d --build

# View logs
docker-compose logs -f app
```

### Vercel

1. Push your code to GitHub
2. Import project in [Vercel dashboard](https://vercel.com/new)
3. Configure environment variables:
   - Add all required variables from `.env.example`
   - Vercel will auto-configure `POSTGRES_URL` and `KV_URL` if you add those integrations
4. Deploy

**Vercel-specific setup:**
- Add Vercel Postgres integration for database
- Add Vercel KV integration for Redis (optional)
- Cron jobs are automatically configured via `vercel.json`

### Self-Hosted VPS

**Requirements:**
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+
- PostgreSQL or Redis
- Nginx (for reverse proxy)
- PM2 (for process management)

**Basic setup:**

```bash
# Clone repository
git clone <repository-url>
cd georgia-utility-monitor

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with production values

# Build application
npm run build

# Start with PM2
pm2 start npm --name "utility-monitor" -- start
pm2 save
pm2 startup
```

**Nginx configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

For SSL setup with Let's Encrypt:
```bash
sudo certbot --nginx -d your-domain.com
```

## 🔍 Troubleshooting

### Application won't start

**Check environment variables:**
```bash
# Verify all required variables are set
cat .env.local | grep -E "NEXTAUTH_SECRET|GOOGLE_CLIENT_ID|ENCRYPTION_KEY"
```

**Check logs:**
```bash
# Development
npm run dev

# Docker
docker-compose logs -f app
```

### Database connection issues

**PostgreSQL:**
```bash
# Test connection
docker-compose exec postgres psql -U dev -d utility_monitor -c "SELECT 1;"

# Check if service is running
docker-compose ps postgres
```

**Redis:**
```bash
# Test connection
docker-compose exec redis redis-cli ping

# Check if service is running
docker-compose ps redis
```

### Authentication not working

1. Verify Google OAuth credentials are correct
2. Check redirect URIs match exactly (including protocol and port)
3. Ensure `NEXTAUTH_URL` matches your actual URL
4. Check browser console for errors

### Notifications not received

1. Test notification configuration in the app
2. Verify ntfy.sh topic is correct
3. Check you're subscribed to the topic in ntfy app/web
4. Review notification history in the app

### Balance checks failing

1. Check provider adapter logs
2. Verify account number format is correct
3. Test manual refresh for specific account
4. Check `/api/health` endpoint for provider success rates

### Port conflicts

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port
PORT=3001 npm run dev
```

### Docker issues

```bash
# Clean up and restart
docker-compose down -v
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### Migration errors

```bash
# Check migration status
npm run migrate

# Reset database (development only!)
docker-compose down -v
docker-compose up -d
npm run migrate
```

## 📚 Additional Documentation

- [DOCKER.md](DOCKER.md) - Comprehensive Docker deployment guide
- [SETUP.md](SETUP.md) - Detailed setup instructions
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) - Authentication setup and usage
- [docs/SESSION-MANAGEMENT.md](docs/SESSION-MANAGEMENT.md) - Session handling details
- [docs/OAUTH-SCHEMA.md](docs/OAUTH-SCHEMA.md) - OAuth database schema

## 🤝 Contributing

Contributions are welcome! Please read `CONTRIBUTING.md` for guidelines on:
- Code style and conventions
- Testing requirements
- Pull request process
- Development workflow

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Notifications powered by [ntfy.sh](https://ntfy.sh)
- Authentication via [NextAuth.js](https://next-auth.js.org/)
- Icons from [Heroicons](https://heroicons.com/)

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: Check the `docs/` directory

---

Made with ❤️ for Georgia residents
