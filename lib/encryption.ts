import crypto from 'crypto';

/**
 * EncryptionService provides AES-256-GCM encryption and decryption
 * for sensitive data at rest (account numbers, notification feed URLs).
 * 
 * Requirements: 14.1, 14.3
 */
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  /**
   * Initialize the encryption service with a key from environment variables.
   * The key is derived using scrypt for additional security.
   * 
   * @param encryptionKey - The encryption key from environment variables
   * @throws Error if encryptionKey is not provided
   */
  constructor(encryptionKey?: string) {
    if (!encryptionKey) {
      throw new Error('Encryption key is required. Set ENCRYPTION_KEY environment variable.');
    }

    // Derive a 32-byte key from the environment variable using scrypt
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Generates a random IV for each encryption operation.
   * 
   * @param plaintext - The text to encrypt
   * @returns Encrypted string in format: iv:authTag:encrypted
   */
  encrypt(plaintext: string): string {
    // Generate a random 16-byte initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher with algorithm, key, and IV
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;
    
    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag for GCM mode
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt ciphertext using AES-256-GCM.
   * Verifies the authentication tag to ensure data integrity.
   * 
   * @param ciphertext - The encrypted string in format: iv:authTag:encrypted
   * @returns Decrypted plaintext
   * @throws Error if ciphertext format is invalid or authentication fails
   */
  decrypt(ciphertext: string): string {
    // Split the ciphertext into its components
    const parts = ciphertext.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected format: iv:authTag:encrypted');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher with algorithm, key, and IV
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
    
    // Set the authentication tag for verification
    decipher.setAuthTag(authTag);
    
    // Decrypt the ciphertext
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

/**
 * Create a singleton instance of EncryptionService using the environment variable.
 * This is the recommended way to use the encryption service throughout the application.
 */
export function createEncryptionService(): EncryptionService {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  return new EncryptionService(encryptionKey);
}
