import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { ensureInitialized } from '@/lib/ensure-init';
import { getStorageAdapter } from '@/lib/storage/factory';
import { createEncryptionService } from '@/lib/encryption';
import { getProviderRegistry } from '@/lib/providers/factory';
import { TelegramService, TelegramUpdate } from '@/lib/telegram-service';
import { User } from '@/lib/storage/types';

function getTelegramService(): TelegramService | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return new TelegramService(token);
}

/**
 * Ensure a user exists for this Telegram chat. Creates one if needed.
 */
async function ensureUser(chatId: string, fromName?: string): Promise<User> {
  const storage = getStorageAdapter();
  const existing = await storage.getUserByTelegramChatId(chatId);
  if (existing) return existing;

  // Create a Telegram-only user
  const userId = randomUUID();
  await storage.createUser({
    userId,
    email: `telegram-${chatId}@bot.local`,
    name: fromName || `Telegram User ${chatId}`,
    emailVerified: null,
    ntfyFeedUrl: '',
    ntfyServerUrl: 'https://ntfy.sh',
    notificationEnabled: true,
    telegramChatId: chatId,
    telegramEnabled: true,
    notificationChannel: 'telegram',
  });

  // createUser doesn't set telegram fields in the INSERT, so update them
  await storage.updateUser(userId, {
    telegramChatId: chatId,
    telegramEnabled: true,
    notificationChannel: 'telegram',
  });

  return (await storage.getUser(userId))!;
}

/**
 * POST /api/telegram/webhook — Receives updates from Telegram Bot API
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const telegram = getTelegramService();
  if (!telegram) return NextResponse.json({ ok: true });

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Handle callback queries (inline keyboard button presses)
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbChatId = String(cb.message?.chat?.id || cb.from.id);
    const cbData = cb.data || '';

    try {
      await ensureInitialized();
      await handleCallback(telegram, cbChatId, cbData);
      // Answer the callback to remove loading state
      await telegram.answerCallbackQuery(cb.id);
    } catch (error) {
      console.error('Telegram callback error:', error);
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text || !message.chat) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const { command, args } = telegram.parseCommand(message.text);

  try {
    await ensureInitialized();
    const storage = getStorageAdapter();

    switch (command) {
      case 'start': {
        const user = await ensureUser(chatId, message.from?.first_name);
        const accounts = await storage.getAccountsByUser(user.userId);
        const hasAccounts = accounts.filter(a => a.enabled).length > 0;

        await telegram.sendMessage(chatId, [
          `👋 <b>Welcome${user.name ? ', ' + user.name : ''}!</b>`,
          '',
          hasAccounts
            ? `You have ${accounts.filter(a => a.enabled).length} account(s). Use /bills to check balances.`
            : 'Get started by adding your utility accounts:',
          '',
          '<b>Commands:</b>',
          '/add — Add a utility account',
          '/bills — View current balances',
          '/check — Force check all balances now',
          '/remove — Remove an account',
          '/status — Check account status',
          '/stop — Pause notifications',
          '/resume — Resume notifications',
        ].join('\n'));
        break;
      }

      case 'link': {
        if (!args) {
          await telegram.sendMessage(chatId, '❌ Please provide a token: <code>/link YOUR_TOKEN</code>');
          break;
        }
        const linkToken = await storage.getTelegramLinkToken(args);
        if (!linkToken) {
          await telegram.sendMessage(chatId, '❌ Invalid or expired token. Generate a new one from the web app.');
          break;
        }
        await storage.updateUser(linkToken.userId, {
          telegramChatId: chatId,
          telegramEnabled: true,
          notificationChannel: 'telegram',
        });
        await storage.markTelegramLinkTokenUsed(args);
        await telegram.sendMessage(chatId, '✅ <b>Account linked successfully!</b>\n\nYou will now receive utility balance notifications here.');
        break;
      }

      case 'add': {
        await ensureUser(chatId, message.from?.first_name);
        await telegram.sendMessageWithKeyboard(chatId, '🏠 <b>Add Utility Account</b>\n\nChoose utility type:', [
          [{ text: '🔥 Gas (te.ge)', callback_data: 'add:gas:te.ge' }],
          [{ text: '⚡ Electricity (TELMICO)', callback_data: 'add:electricity:telmico' }],
        ]);
        break;
      }

      case 'remove': {
        const user = await ensureUser(chatId, message.from?.first_name);
        const encService = createEncryptionService();
        const accounts = await storage.getAccountsByUser(user.userId);
        const enabled = accounts.filter(a => a.enabled);
        if (enabled.length === 0) {
          await telegram.sendMessage(chatId, '📭 No accounts to remove. Use /add to add one.');
          break;
        }
        const buttons = enabled.map(a => {
          const icon = a.providerType === 'gas' ? '🔥' : '⚡';
          let num: string;
          try { num = encService.decrypt(a.accountNumber); } catch { num = '***'; }
          return [{ text: `${icon} ${a.providerName} (${num})`, callback_data: `rm:${a.accountId}` }];
        });
        await telegram.sendMessageWithKeyboard(chatId, '🗑 <b>Remove Account</b>\n\nChoose account to remove:', buttons);
        break;
      }

      case 'stop': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) { await telegram.sendMessage(chatId, '❌ Send /start first.'); break; }
        await storage.updateUser(user.userId, { telegramEnabled: false });
        await telegram.sendMessage(chatId, '🔇 Notifications paused. Use /resume to re-enable.');
        break;
      }

      case 'resume': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) { await telegram.sendMessage(chatId, '❌ Send /start first.'); break; }
        await storage.updateUser(user.userId, { telegramEnabled: true });
        await telegram.sendMessage(chatId, '🔔 Notifications resumed!');
        break;
      }

      case 'status': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) { await telegram.sendMessage(chatId, '❌ Send /start first.'); break; }
        const accounts = await storage.getAccountsByUser(user.userId);
        const enabledAccounts = accounts.filter(a => a.enabled);
        await telegram.sendMessage(chatId, [
          '📊 <b>Account Status</b>',
          '',
          `Notifications: ${user.telegramEnabled ? '🔔 Active' : '🔇 Paused'}`,
          `Accounts: ${enabledAccounts.length} active`,
          ...enabledAccounts.map(a => `  • ${a.providerName} (${a.providerType})`),
        ].join('\n'));
        break;
      }

      case 'whoami': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) { await telegram.sendMessage(chatId, '❌ Send /start first.'); break; }
        await telegram.sendMessage(chatId, [
          '👤 <b>Your Profile</b>',
          '',
          `Name: ${user.name}`,
          `Email: ${user.email}`,
          `User ID: <code>${user.userId}</code>`,
        ].join('\n'));
        break;
      }

      case 'bills': {
        const user = await storage.getUserByTelegramChatId(chatId);
        if (!user) { await telegram.sendMessage(chatId, '❌ Send /start first.'); break; }
        const encryptionService = createEncryptionService();
        const userAccounts = await storage.getAccountsByUser(user.userId);
        const enabledAccounts = userAccounts.filter(a => a.enabled);

        if (enabledAccounts.length === 0) {
          await telegram.sendMessage(chatId, '📭 No accounts yet. Use /add to add one.');
          break;
        }

        const lines: string[] = ['💰 <b>Current Balances</b>', ''];
        for (const account of enabledAccounts) {
          const icon = account.providerType === 'gas' ? '🔥' : account.providerType === 'electricity' ? '⚡' : '📊';
          let accountNum: string;
          try { accountNum = encryptionService.decrypt(account.accountNumber); } catch { accountNum = '***'; }
          const latest = await storage.getLatestBalance(account.accountId);
          const balanceStr = latest && latest.success
            ? `${latest.balance.toFixed(2)} ₾` : latest ? '⚠️ check failed' : 'never checked';
          const lastChecked = latest?.checkedAt ? new Date(latest.checkedAt).toLocaleString() : 'never';
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
        if (!user) { await telegram.sendMessage(chatId, '❌ Send /start first.'); break; }
        const encService = createEncryptionService();
        const providerReg = getProviderRegistry();
        const checkAccounts = (await storage.getAccountsByUser(user.userId)).filter(a => a.enabled);

        if (checkAccounts.length === 0) {
          await telegram.sendMessage(chatId, '📭 No accounts to check. Use /add to add one.');
          break;
        }

        await telegram.sendMessage(chatId, `🔄 Checking ${checkAccounts.length} account(s)...`);

        const results: string[] = ['✅ <b>Balance Check Results</b>', ''];
        for (const account of checkAccounts) {
          const icon = account.providerType === 'gas' ? '🔥' : account.providerType === 'electricity' ? '⚡' : '📊';
          let accountNum: string;
          try { accountNum = encService.decrypt(account.accountNumber); } catch { accountNum = '***'; }
          const provider = providerReg.getAdapter(account.providerName);
          if (!provider) { results.push(`${icon} ${account.providerName}: ❌ provider not found`); continue; }
          const result = await provider.fetchBalance(accountNum);
          if (result.success) {
            await storage.recordBalance({
              accountId: account.accountId, balance: result.balance,
              currency: result.currency, checkedAt: result.timestamp, success: true,
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
        if (!user) { await telegram.sendMessage(chatId, '❌ No account to unlink.'); break; }
        await storage.updateUser(user.userId, {
          telegramChatId: undefined, telegramEnabled: false, notificationChannel: 'ntfy',
        });
        await telegram.sendMessage(chatId, '✅ Account unlinked.');
        break;
      }

      case 'version': {
        const commit = process.env.NEXT_PUBLIC_GIT_COMMIT || 'unknown';
        await telegram.sendMessage(chatId, `🔧 <b>Version</b>\n\nCommit: <code>${commit}</code>`);
        break;
      }

      default:
        // Check if this is a plain text reply (account number input)
        if (!command && message.text) {
          await handleTextInput(telegram, storage, chatId, message.text.trim());
        } else {
          await telegram.sendMessage(chatId, '❓ Unknown command. Try /add, /bills, /check, /status, or /start for help.');
        }
    }
  } catch (error) {
    console.error('Telegram webhook error:', error);
    try { await telegram.sendMessage(chatId, '⚠️ Something went wrong. Please try again later.'); } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true });
}

// Simple in-memory state for multi-step flows (account number input)
// In production, use Redis or DB. For now, this works on a single serverless instance.
const pendingAdditions = new Map<string, { providerType: string; providerName: string; expiresAt: number }>();

async function handleCallback(telegram: TelegramService, chatId: string, data: string) {
  const storage = getStorageAdapter();

  // Handle "add:gas:te.ge" or "add:electricity:telmico"
  if (data.startsWith('add:')) {
    const [, providerType, providerName] = data.split(':');
    const icon = providerType === 'gas' ? '🔥' : '⚡';
    const format = providerType === 'gas'
      ? '9 digits (e.g. 473307-780) or 12 digits'
      : '7 digits (e.g. 4823463)';

    // Store pending state
    pendingAdditions.set(chatId, {
      providerType, providerName,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min timeout
    });

    await telegram.sendMessage(chatId, [
      `${icon} <b>Adding ${providerName} account</b>`,
      '',
      `Please send your account number now.`,
      `Format: ${format}`,
    ].join('\n'));
    return;
  }

  // Handle "rm:{accountId}"
  if (data.startsWith('rm:')) {
    const accountId = data.substring(3);
    const account = await storage.getAccount(accountId);
    if (account) {
      await storage.deleteAccount(accountId);
      await telegram.sendMessage(chatId, `✅ Removed ${account.providerName} account.`);
    } else {
      await telegram.sendMessage(chatId, '❌ Account not found.');
    }
    return;
  }
}

async function handleTextInput(
  telegram: TelegramService,
  storage: ReturnType<typeof getStorageAdapter>,
  chatId: string,
  text: string
) {
  const pending = pendingAdditions.get(chatId);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingAdditions.delete(chatId);
    return; // Not expecting input, ignore
  }

  pendingAdditions.delete(chatId);

  const { providerType, providerName } = pending;
  const registry = getProviderRegistry();
  const provider = registry.getAdapter(providerName);

  if (!provider) {
    await telegram.sendMessage(chatId, `❌ Provider ${providerName} not found.`);
    return;
  }

  if (!provider.validateAccountNumber(text)) {
    await telegram.sendMessage(chatId, `❌ Invalid account number format. Expected: ${provider.getAccountNumberFormat()}\n\nUse /add to try again.`);
    return;
  }

  const user = await storage.getUserByTelegramChatId(chatId);
  if (!user) {
    await telegram.sendMessage(chatId, '❌ Send /start first.');
    return;
  }

  const encService = createEncryptionService();
  const encrypted = encService.encrypt(text);

  const accountId = await storage.createAccount({
    userId: user.userId,
    providerType: providerType as 'gas' | 'electricity',
    providerName,
    accountNumber: encrypted,
    enabled: true,
  });

  const icon = providerType === 'gas' ? '🔥' : '⚡';
  await telegram.sendMessage(chatId, [
    `${icon} <b>Account added!</b>`,
    '',
    `Provider: ${providerName}`,
    `Account: ${text}`,
    '',
    'Use /check to check your balance now.',
  ].join('\n'));
}
