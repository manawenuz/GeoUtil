import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/lib/telegram-service';

/**
 * POST /api/telegram/setup-webhook — One-time admin endpoint to register the webhook URL
 *
 * Requires CRON_SECRET for authorization.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
  }
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXTAUTH_URL not set' }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  const telegram = new TelegramService(botToken);
  const success = await telegram.setWebhook(webhookUrl, webhookSecret);

  if (success) {
    return NextResponse.json({ ok: true, webhookUrl });
  } else {
    return NextResponse.json({ error: 'Failed to set webhook' }, { status: 500 });
  }
}
