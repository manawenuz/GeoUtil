# Authentication Pages

This directory contains the authentication pages for the Georgia Utility Monitor application.

## Pages

### Sign-In Page (`/auth/signin`)

The sign-in page provides Google OAuth authentication with:
- Clean, user-friendly UI
- Google sign-in button with proper branding
- Loading states during authentication
- Error message display from URL parameters
- Callback URL support for post-authentication redirects

**Features:**
- Responsive design with Tailwind CSS
- Loading spinner during sign-in process
- Comprehensive error handling
- Security messaging to build user trust

### Error Page (`/auth/error`)

The error page handles OAuth authentication errors with:
- User-friendly error messages for all NextAuth error codes
- Contextual help text
- Retry functionality when appropriate
- Navigation back to home or sign-in

**Supported Error Codes:**
- `Configuration` - Server configuration issues
- `AccessDenied` - User denied OAuth consent
- `Verification` - Token verification failed
- `OAuthSignin` - OAuth sign-in flow error
- `OAuthCallback` - OAuth callback error
- `OAuthCreateAccount` - Account creation error
- `OAuthAccountNotLinked` - Email already exists with different provider
- `SessionRequired` - Authentication required
- And more...

## Components

### SignOutButton (`/components/auth/SignOutButton.tsx`)

A reusable sign-out button component with:
- Three variants: primary, secondary, danger
- Loading states
- Customizable styling via className prop
- Automatic redirect to home page after sign-out

**Usage:**
```tsx
import SignOutButton from "@/components/auth/SignOutButton";

<SignOutButton variant="primary" />
<SignOutButton variant="secondary" className="w-full" />
```

### UserMenu (`/components/auth/UserMenu.tsx`)

A user profile menu component with:
- User avatar (Google profile picture or initials)
- User name and email display
- Dropdown menu with navigation links
- Sign-out functionality
- Loading and unauthenticated states
- Click-outside-to-close functionality

**Features:**
- Responsive design (hides user info on mobile)
- Next.js Image optimization for profile pictures
- Smooth transitions and animations
- Accessible keyboard navigation

### SessionProvider (`/components/auth/SessionProvider.tsx`)

A wrapper component for NextAuth's SessionProvider that:
- Provides session context to all client components
- Enables `useSession()` hook throughout the app
- Handles session state management

## Integration

The authentication system is integrated into the app through:

1. **Root Layout** (`app/layout.tsx`): Wraps the entire app with SessionProvider
2. **Home Page** (`app/page.tsx`): Displays UserMenu in the header
3. **NextAuth Configuration** (`lib/auth.ts`): Configures Google OAuth and custom pages
4. **Auth Helpers** (`lib/auth-helpers.ts`): Provides server-side authentication utilities

## Requirements Satisfied

- **Requirement 14.2**: Google OAuth authentication with sign-in page
- **Requirement 14.13**: Sign-out functionality with session invalidation

## Environment Variables

Required environment variables for authentication:
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXTAUTH_SECRET` - Secret for signing JWT tokens
- `NEXTAUTH_URL` - Base URL of the application

## Security Features

- HTTP-only session cookies
- Secure cookies in production (HTTPS only)
- SameSite cookie protection
- 30-day session expiration
- CSRF protection via NextAuth
- Session validation on all protected routes
