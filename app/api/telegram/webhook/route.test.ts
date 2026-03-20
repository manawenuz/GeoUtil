import { POST } from './route';
import { NextRequest } from 'next/server';
import { getStorageAdapter } from '@/lib/storage/factory';

jest.mock('@/lib/storage/factory');
jest.mock('@/lib/ensure-init', () => ({
  ensureInitialized: jest.fn().mockResolvedValue(undefined),
}));

// Mock TelegramService
const mockSendMessage = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/telegram-service', () => ({
  TelegramService: jest.fn().mockImplementation(() => ({
    sendMessage: mockSendMessage,
    parseCommand: jest.requireActual('@/lib/telegram-service').TelegramService.prototype.parseCommand,
  })),
}));

function makeRequest(body: object, secret?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-telegram-bot-api-secret-token'] = secret;
  return new NextRequest('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function telegramUpdate(text: string, chatId = 12345) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: chatId, first_name: 'Test' },
      chat: { id: chatId, type: 'private' },
      text,
      date: Date.now(),
    },
  };
}

describe('POST /api/telegram/webhook', () => {
  const mockStorage = {
    getTelegramLinkToken: jest.fn(),
    markTelegramLinkTokenUsed: jest.fn(),
    updateUser: jest.fn(),
    getUserByTelegramChatId: jest.fn(),
    getAccountsByUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    (getStorageAdapter as jest.Mock).mockReturnValue(mockStorage);
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('returns 401 for invalid webhook secret', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'correct-secret';
    const res = await POST(makeRequest(telegramUpdate('/start'), 'wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('accepts valid webhook secret', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'correct-secret';
    const res = await POST(makeRequest(telegramUpdate('/start'), 'correct-secret'));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('handles /start command', async () => {
    const res = await POST(makeRequest(telegramUpdate('/start')));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Welcome')
    );
  });

  it('handles /link with valid token', async () => {
    mockStorage.getTelegramLinkToken.mockResolvedValue({
      token: 'valid-token',
      userId: 'user-123',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      used: false,
    });

    const res = await POST(makeRequest(telegramUpdate('/link valid-token')));
    expect(res.status).toBe(200);

    expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', {
      telegramChatId: '12345',
      telegramEnabled: true,
      notificationChannel: 'telegram',
    });
    expect(mockStorage.markTelegramLinkTokenUsed).toHaveBeenCalledWith('valid-token');
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('linked successfully'));
  });

  it('handles /link with invalid token', async () => {
    mockStorage.getTelegramLinkToken.mockResolvedValue(null);

    const res = await POST(makeRequest(telegramUpdate('/link bad-token')));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('Invalid or expired'));
  });

  it('handles /link without token argument', async () => {
    const res = await POST(makeRequest(telegramUpdate('/link')));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('provide a token'));
  });

  it('handles /stop for linked user', async () => {
    mockStorage.getUserByTelegramChatId.mockResolvedValue({ userId: 'user-123' });

    const res = await POST(makeRequest(telegramUpdate('/stop')));
    expect(res.status).toBe(200);
    expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', { telegramEnabled: false });
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('paused'));
  });

  it('handles /stop for unlinked user', async () => {
    mockStorage.getUserByTelegramChatId.mockResolvedValue(null);

    const res = await POST(makeRequest(telegramUpdate('/stop')));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('No account linked'));
  });

  it('handles /resume for linked user', async () => {
    mockStorage.getUserByTelegramChatId.mockResolvedValue({ userId: 'user-123' });

    const res = await POST(makeRequest(telegramUpdate('/resume')));
    expect(res.status).toBe(200);
    expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', { telegramEnabled: true });
  });

  it('handles /status for linked user', async () => {
    mockStorage.getUserByTelegramChatId.mockResolvedValue({
      userId: 'user-123',
      telegramEnabled: true,
      notificationChannel: 'telegram',
    });
    mockStorage.getAccountsByUser.mockResolvedValue([
      { providerName: 'te.ge', providerType: 'gas', enabled: true },
      { providerName: 'telmico', providerType: 'electricity', enabled: true },
    ]);

    const res = await POST(makeRequest(telegramUpdate('/status')));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('2 active'));
  });

  it('handles /unlink for linked user', async () => {
    mockStorage.getUserByTelegramChatId.mockResolvedValue({ userId: 'user-123' });

    const res = await POST(makeRequest(telegramUpdate('/unlink')));
    expect(res.status).toBe(200);
    expect(mockStorage.updateUser).toHaveBeenCalledWith('user-123', {
      telegramChatId: undefined,
      telegramEnabled: false,
      notificationChannel: 'ntfy',
    });
  });

  it('handles unknown command', async () => {
    const res = await POST(makeRequest(telegramUpdate('/unknown')));
    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('Unknown command'));
  });

  it('returns 200 for malformed body', async () => {
    const req = new NextRequest('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 200 for update without message', async () => {
    const res = await POST(makeRequest({ update_id: 1 }));
    expect(res.status).toBe(200);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
