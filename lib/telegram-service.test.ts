import { TelegramService } from './telegram-service';

// Mock axios
jest.mock('axios');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(() => {
    service = new TelegramService('test-bot-token');
    jest.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('parses /start', () => {
      expect(service.parseCommand('/start')).toEqual({ command: 'start', args: '' });
    });

    it('parses /link with token', () => {
      expect(service.parseCommand('/link abc123def')).toEqual({ command: 'link', args: 'abc123def' });
    });

    it('parses /link@botname with token', () => {
      expect(service.parseCommand('/link@mybot abc123')).toEqual({ command: 'link', args: 'abc123' });
    });

    it('parses /stop', () => {
      expect(service.parseCommand('/stop')).toEqual({ command: 'stop', args: '' });
    });

    it('parses /resume', () => {
      expect(service.parseCommand('/resume')).toEqual({ command: 'resume', args: '' });
    });

    it('parses /status', () => {
      expect(service.parseCommand('/status')).toEqual({ command: 'status', args: '' });
    });

    it('parses /unlink', () => {
      expect(service.parseCommand('/unlink')).toEqual({ command: 'unlink', args: '' });
    });

    it('returns empty command for non-command text', () => {
      expect(service.parseCommand('hello world')).toEqual({ command: '', args: 'hello world' });
    });

    it('handles extra whitespace', () => {
      expect(service.parseCommand('  /link   token123  ')).toEqual({ command: 'link', args: 'token123' });
    });

    it('normalizes command to lowercase', () => {
      expect(service.parseCommand('/START')).toEqual({ command: 'start', args: '' });
    });
  });

  describe('sendMessage', () => {
    it('calls Telegram API with correct payload', async () => {
      axios.post.mockResolvedValue({ data: { ok: true } });

      const result = await service.sendMessage('12345', 'Hello!');

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        { chat_id: '12345', text: 'Hello!', parse_mode: 'HTML' },
        { timeout: 10000 }
      );
    });

    it('returns false on failure', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const result = await service.sendMessage('12345', 'Hello!');

      expect(result).toBe(false);
    });
  });

  describe('setWebhook', () => {
    it('calls setWebhook API with URL and secret', async () => {
      axios.post.mockResolvedValue({ data: { ok: true } });

      const result = await service.setWebhook('https://example.com/webhook', 'my-secret');

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/setWebhook',
        { url: 'https://example.com/webhook', secret_token: 'my-secret' },
        { timeout: 10000 }
      );
    });

    it('returns false on failure', async () => {
      axios.post.mockRejectedValue(new Error('fail'));
      const result = await service.setWebhook('https://example.com/webhook');
      expect(result).toBe(false);
    });
  });

  describe('formatBalanceNotification', () => {
    it('formats gas balance notification', () => {
      const msg = service.formatBalanceNotification('te.ge', 'gas', 73.94);
      expect(msg).toContain('te.ge');
      expect(msg).toContain('🔥');
      expect(msg).toContain('73.94');
      expect(msg).toContain('⚠️');
    });

    it('formats zero balance notification', () => {
      const msg = service.formatBalanceNotification('telmico', 'electricity', 0);
      expect(msg).toContain('telmico');
      expect(msg).toContain('⚡');
      expect(msg).toContain('0.00');
      expect(msg).toContain('✅');
    });
  });
});
