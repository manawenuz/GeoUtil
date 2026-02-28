import { EncryptionService } from './encryption';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    // Use a test encryption key
    encryptionService = new EncryptionService('test-encryption-key-for-testing');
  });

  describe('constructor', () => {
    it('should throw error if encryption key is not provided', () => {
      expect(() => new EncryptionService(undefined)).toThrow(
        'Encryption key is required. Set ENCRYPTION_KEY environment variable.'
      );
    });

    it('should create instance with valid encryption key', () => {
      expect(() => new EncryptionService('valid-key')).not.toThrow();
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return string in correct format', () => {
      const plaintext = 'sensitive-account-number-12345';
      const encrypted = encryptionService.encrypt(plaintext);

      // Should return format: iv:authTag:encrypted
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/); // IV in hex
      expect(parts[1]).toMatch(/^[0-9a-f]+$/); // Auth tag in hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/); // Encrypted data in hex
    });

    it('should generate different IVs for same plaintext', () => {
      const plaintext = 'test-data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt empty string', () => {
      const encrypted = encryptionService.encrypt('');
      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should encrypt various input sizes', () => {
      const inputs = [
        'a',
        'short text',
        'a'.repeat(100),
        'a'.repeat(1000),
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        'Unicode: 你好世界 🌍',
      ];

      inputs.forEach((input) => {
        const encrypted = encryptionService.encrypt(input);
        expect(encrypted.split(':')).toHaveLength(3);
      });
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext back to original plaintext', () => {
      const plaintext = 'sensitive-account-number-12345';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt empty string', () => {
      const plaintext = '';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt various input sizes', () => {
      const inputs = [
        'a',
        'short text',
        'a'.repeat(100),
        'a'.repeat(1000),
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        'Unicode: 你好世界 🌍',
      ];

      inputs.forEach((input) => {
        const encrypted = encryptionService.encrypt(input);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(input);
      });
    });

    it('should throw error for invalid ciphertext format', () => {
      expect(() => encryptionService.decrypt('invalid')).toThrow(
        'Invalid ciphertext format. Expected format: iv:authTag:encrypted'
      );

      expect(() => encryptionService.decrypt('only:two')).toThrow(
        'Invalid ciphertext format. Expected format: iv:authTag:encrypted'
      );

      expect(() => encryptionService.decrypt('too:many:parts:here')).toThrow(
        'Invalid ciphertext format. Expected format: iv:authTag:encrypted'
      );
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // Tamper with the encrypted data
      const parts = encrypted.split(':');
      parts[2] = parts[2].slice(0, -2) + 'ff'; // Change last byte
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow();
    });

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // Tamper with the auth tag
      const parts = encrypted.split(':');
      parts[1] = parts[1].slice(0, -2) + 'ff'; // Change last byte of auth tag
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should maintain data integrity for account numbers', () => {
      const accountNumbers = [
        '123456789012',
        '000000000000',
        '999999999999',
        'ABC123XYZ789',
      ];

      accountNumbers.forEach((accountNumber) => {
        const encrypted = encryptionService.encrypt(accountNumber);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(accountNumber);
      });
    });

    it('should maintain data integrity for notification URLs', () => {
      const urls = [
        'https://ntfy.sh/my-topic',
        'https://ntfy.example.com/user123',
        'https://self-hosted.com:8080/notifications',
      ];

      urls.forEach((url) => {
        const encrypted = encryptionService.encrypt(url);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(url);
      });
    });

    it('should work with different encryption service instances using same key', () => {
      const service1 = new EncryptionService('shared-key');
      const service2 = new EncryptionService('shared-key');

      const plaintext = 'test-data';
      const encrypted = service1.encrypt(plaintext);
      const decrypted = service2.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with different encryption keys', () => {
      const service1 = new EncryptionService('key-one');
      const service2 = new EncryptionService('key-two');

      const plaintext = 'test-data';
      const encrypted = service1.encrypt(plaintext);

      // Decrypting with different key should fail
      expect(() => service2.decrypt(encrypted)).toThrow();
    });
  });
});
