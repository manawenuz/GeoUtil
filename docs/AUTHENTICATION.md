# Authentication Setup

The Georgia Utility Monitor uses Google OAuth 2.0 for authentication via NextAuth.js.

## Google OAuth Configuration

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API for your project

### 2. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Configure the OAuth consent screen if prompted:
   - User Type: External (for public access) or Internal (for organization only)
   - App name: Georgia Utility Monitor
   - User support email: Your email
   - Developer contact: Your email
5. Add authorized redirect URIs:
   - For local development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-domain.com/api/auth/callback/google`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 3. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Production Deployment

For production (e.g., Vercel):

1. Add the production redirect URI to Google OAuth credentials:
   ```
   https://your-domain.com/api/auth/callback/google
   ```

2. Set environment variables in your hosting platform:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   NEXTAUTH_SECRET=your-production-secret
   NEXTAUTH_URL=https://your-domain.com
   ```

## Usage in API Routes

### Require Authentication

```typescript
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    
    // Your authenticated logic here
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

### Optional Authentication

```typescript
import { getSession } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  const session = await getSession();
  
  if (session) {
    // User is authenticated
    const userId = session.user.id;
  } else {
    // User is not authenticated
  }
  
  return Response.json({ success: true });
}
```

## Session Configuration

- **Strategy**: JWT (will be migrated to database sessions in Task 14.2)
- **Duration**: 30 days
- **Cookie Settings**:
  - HTTP-only: true
  - SameSite: lax
  - Secure: true (in production)

## Security Features

- HTTP-only cookies prevent XSS attacks
- CSRF protection built into NextAuth
- Secure cookies in production (HTTPS only)
- 30-day session expiration with automatic renewal

## Next Steps

Task 14.2 will implement:
- Database-backed sessions using the StorageAdapter interface
- Support for Redis, Postgres, and SQLite session storage
- User profile storage in the database
- OAuth account linking
