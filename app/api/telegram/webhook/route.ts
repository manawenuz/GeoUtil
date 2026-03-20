import { NextRequest, NextResponse } from 'next/server';
import { ensureInitialized } from '@/lib/ensure-init';
import { getStorageAdapter } from '@/lib/storage/factory';
import { TelegramService, TelegramUpdate } from '@/lib/telegram-service';

function getTelegramService(): TelegramService | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return new TelegramService(token);
}

/**
 * POST /api/telegram/webhook — Receives updates from Telegram Bot API
 */
export async function POST(request: NextRequest) {
  // Verify webhook secret if configured
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const telegram = getTelegramService();
  if (!telegram) {
    return NextResponse.json({ ok: true }); // Acknowledge but can't respond
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  console.log('[Telegram Webhook] Received update:', JSON.stringify(update, null, 2));

  const message = update.message;
  if (!message?.text || !message.chat) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const { command, args } = telegram.parseCommand(message.text);
  console.log(`[Telegram Webhook] chat_id=${chatId}, from=${message.from?.username}, command=${command}, args=${args}`);

  try {
    await ensureInitialized();
    const storage = getStorageAdapter();

    switch (command) {
      case 'start':
        await telegram.sendMessage(chatId, [
          '👋 <b>Welcome to Georgia Utility Monitor!</b>',
          '',
          'Link your account to receive balance notifications here.',
          '',
          '1. Go to your web app → Notification Settings',
          '2. Click "Generate Telegram Link Token"',
          '3. Send: <code>/link YOUR_TOKEN</code>',
          '',
          '<b>Commands:</b>',
          '/link &lt;token&gt; — Link your account',
          '/bills — View current balances',
          '/check — Force check all balances now',
          '/whoami — Show your profile',
          '/status — Check link status',
          '/stop — Pause notifications',
          '/resume — Resume notifications',
          '/unlink — Unlink your account',
        ].join('\n'));
        break;

      case 'link': {
        if (!args) {
          await telegram.sendMessage(chatId, '❌ Please provide a token: <code>/link YOUR_TOKEN</code>');
          break;
        }

        const linkToken = await storage.getTelegramLinkToken(args);
        if (!linkToken) {
          await telegram.sendMessage(chatId, '❌ Invalid or expired token. Please generate a new one from the web app.');
          break;
        }

        // Link the Telegram chat to the user
        await storage.updateUser(linkToken.userId, {
          telegramChatId: chatId,
          telegramEnabled: true,
          notificationChannel: 'telegram',
        });
        await storage.markTelegramLinkTokenUsed(args);

        await telegram.sendMessage(chatId, '✅ <b>Account linked successfully!</b>\n\nYou will now receive utility balance notifications here.');
        break;
      }

      case 'stop': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked. Use /link to connect first.');
          break;
        }
        await storage.updateUser(user.userId, { telegramEnabled: false });
        await telegram.sendMessage(chatId, '🔇 Notifications paused. Use /resume to re-enable.');
        break;
      }

      case 'resume': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked. Use /link to connect first.');
          break;
        }
        await storage.updateUser(user.userId, { telegramEnabled: true });
        await telegram.sendMessage(chatId, '🔔 Notifications resumed!');
        break;
      }

      case 'status': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked. Use /link to connect first.');
          break;
        }
        const accounts = await storage.getAccountsByUser(user.userId);
        const enabledAccounts = accounts.filter(a => a.enabled);
        await telegram.sendMessage(chatId, [
          '📊 <b>Account Status</b>',
          '',
          `Notifications: ${user.telegramEnabled ? '🔔 Active' : '🔇 Paused'}`,
          `Channel: ${user.notificationChannel}`,
          `Accounts: ${enabledAccounts.length} active`,
          ...enabledAccounts.map(a => `  • ${a.providerName} (${a.providerType})`),
        ].join('\n'));
        break;
      }

      case 'whoami': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked. Use /link to connect first.');
          break;
        }
        await telegram.sendMessage(chatId, [
          '👤 <b>Your Profile</b>',
          '',
          `Name: ${user.name}`,
          `Email: ${user.email}`,
          `User ID: <code>${user.userId}</code>`,
          `Joined: ${user.createdAt.toLocaleDateString()}`,
        ].join('\n'));
        break;
      }

      case 'bills': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked. Use /link to connect first.');
          break;
        }
        const encryptionService = (await import('@/lib/encryption')).createEncryptionService();
        const userAccounts = await storage.getAccountsByUser(user.userId);
        const enabledAccounts = userAccounts.filter(a => a.enabled);

        if (enabledAccounts.length === 0) {
          await telegram.sendMessage(chatId, '📭 No active accounts. Add accounts via the web app.');
          break;
        }

        const lines: string[] = ['💰 <b>Current Balances</b>', ''];
        for (const account of enabledAccounts) {
          const icon = account.providerType === 'gas' ? '🔥' : account.providerType === 'electricity' ? '⚡' : '📊';
          let accountNum: string;
          try {
            accountNum = encryptionService.decrypt(account.accountNumber);
          } catch {
            accountNum = '***';
          }
          const latest = await storage.getLatestBalance(account.accountId);
          const balanceStr = latest && latest.success
            ? `${latest.balance.toFixed(2)} ₾`
            : latest ? '⚠️ check failed' : 'never checked';
          const lastChecked = latest?.checkedAt
            ? new Date(latest.checkedAt).toLocaleString()
            : 'never';

          lines.push(`${icon} <b>${account.providerName}</b> (${accountNum})`);
          lines.push(`   Balance: <b>${balanceStr}</b>`);
          lines.push(`   Last checked: ${lastChecked}`);
          lines.push('');
        }

        await telegram.sendMessage(chatId, lines.join('\n'));
        break;
      }

      case 'check': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked. Use /link to connect first.');
          break;
        }
        const encService = (await import('@/lib/encryption')).createEncryptionService();
        const providerRegistry = (await import('@/lib/providers/factory')).getProviderRegistry();
        const checkAccounts = await storage.getAccountsByUser(user.userId);
        const activeAccounts = checkAccounts.filter(a => a.enabled);

        if (activeAccounts.length === 0) {
          await telegram.sendMessage(chatId, '📭 No active accounts to check.');
          break;
        }

        await telegram.sendMessage(chatId, `🔄 Checking ${activeAccounts.length} account(s)...`);

        const results: string[] = ['✅ <b>Balance Check Results</b>', ''];
        for (const account of activeAccounts) {
          const icon = account.providerType === 'gas' ? '🔥' : account.providerType === 'electricity' ? '⚡' : '📊';
          let accountNum: string;
          try {
            accountNum = encService.decrypt(account.accountNumber);
          } catch {
            accountNum = '***';
          }
          const provider = providerRegistry.getAdapter(account.providerName);
          if (!provider) {
            results.push(`${icon} ${account.providerName}: ❌ provider not found`);
            continue;
          }
          const result = await provider.fetchBalance(accountNum);
          if (result.success) {
            await storage.recordBalance({
              accountId: account.accountId,
              balance: result.balance,
              currency: result.currency,
              checkedAt: result.timestamp,
              success: true,
            });
            const emoji = result.balance > 0 ? '⚠️' : '✅';
            results.push(`${icon} <b>${account.providerName}</b>: ${emoji} ${result.balance.toFixed(2)} ₾`);
          } else {
            results.push(`${icon} <b>${account.providerName}</b>: ❌ ${result.error}`);
          }
          results.push('');
        }

        await telegram.sendMessage(chatId, results.join('\n'));
        break;
      }

      case 'unlink': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) {
          await telegram.sendMessage(chatId, '❌ No account linked.');
          break;
        }
        await storage.updateUser(user.userId, {
          telegramChatId: undefined,
          telegramEnabled: false,
          notificationChannel: 'ntfy',
        });
        await telegram.sendMessage(chatId, '✅ Account unlinked. You will no longer receive notifications here.');
        break;
      }

      default:
        await telegram.sendMessage(chatId, '❓ Unknown command. Try /bills, /check, /whoami, /status, or /start for help.');
    }
  } catch (error) {
    console.error('Telegram webhook error:', error);
    // Try to notify user of error
    try {
      await telegram.sendMessage(chatId, '⚠️ Something went wrong. Please try again later.');
    } catch { /* ignore */ }
  }

  // Always return 200 to Telegram
  return NextResponse.json({ ok: true });
}
