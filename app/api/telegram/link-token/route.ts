import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { withAuth } from '@/lib/auth-helpers';
import { ensureInitialized } from '@/lib/ensure-init';
import { getStorageAdapter } from '@/lib/storage/factory';

/**
 * POST /api/telegram/link-token — Generate a short-lived token to link Telegram
 */
export const POST = withAuth(async (_request: NextRequest, session) => {
  try {
    await ensureInitialized();
    const storage = getStorageAdapter();
    const userId = session.user.id;

    // Generate 32-byte random token (64 hex chars)
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await storage.createTelegramLinkToken(userId, token, expiresAt);

    // Clean up old tokens in the background
    storage.cleanExpiredTelegramLinkTokens().catch(() => {});

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
    });
  } catch (error) {
    console.error('Error generating link token:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate link token' },
      { status: 500 }
    );
  }
});
