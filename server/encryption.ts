import crypto from 'crypto';

/**
 * Encryption service for securing sensitive DNIT credentials
 * Uses AES-256-GCM for symmetric encryption with authentication
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  /**
   * Get encryption key from environment variable
   * If not set, generates a warning-level key for development
   */
  private static getEncryptionKey(): Buffer {
    const envKey = process.env.DNIT_ENCRYPTION_KEY;
    
    if (!envKey) {
      console.warn('⚠️  DNIT_ENCRYPTION_KEY not set. Using default key. NOT SECURE FOR PRODUCTION!');
      // Default key for development only - NOT secure for production
      return Buffer.from('dev-default-key-not-secure-change-in-production!', 'utf-8').subarray(0, 32);
    }
    
    if (envKey.length < 32) {
      throw new Error('DNIT_ENCRYPTION_KEY must be at least 32 characters long');
    }
    
    // Use first 32 bytes of the key
    return Buffer.from(envKey, 'utf-8').subarray(0, 32);
  }

  /**
   * Encrypt sensitive text using AES-256-GCM
   * Returns base64 encoded string with format: salt:iv:tag:encrypted
   */
  static encrypt(text: string): string {
    if (!text || text.trim() === '') {
      return text; // Don't encrypt empty values
    }

    try {
      const key = this.getEncryptionKey();
      
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Derive key with salt using PBKDF2
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha256');
      
      // Create cipher with IV (FIXED: was createCipher)
      const cipher = crypto.createCipheriv(this.ALGORITHM, derivedKey, iv);
      cipher.setAAD(Buffer.from('dnit-config', 'utf-8'));
      
      // Encrypt the text
      const encryptedBuffer = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      const encrypted = encryptedBuffer.toString('base64');
      
      // Return format: salt:iv:tag:encrypted (all base64)
      return [
        salt.toString('base64'),
        iv.toString('base64'), 
        tag.toString('base64'),
        encrypted
      ].join(':');
      
    } catch (error) {
      console.error('Encryption failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt text encrypted with encrypt method
   * Expects format: salt:iv:tag:encrypted
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || encryptedText.trim() === '') {
      return encryptedText; // Return empty values as-is
    }

    // Check if this looks like encrypted data
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      // Not encrypted format, return as-is (for backward compatibility)
      return encryptedText;
    }

    try {
      const key = this.getEncryptionKey();
      
      // Parse components
      const [saltB64, ivB64, tagB64, encrypted] = parts;
      const salt = Buffer.from(saltB64, 'base64');
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');
      
      // Derive key with salt
      const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, 'sha256');
      
      // Create decipher with IV (FIXED: was createDecipher)
      const decipher = crypto.createDecipheriv(this.ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from('dnit-config', 'utf-8'));
      
      // Decrypt
      const encryptedBuffer = Buffer.from(encrypted, 'base64');
      const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);
      const decrypted = decryptedBuffer.toString('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
      // Return original text if decryption fails (backward compatibility)
      return encryptedText;
    }
  }

  /**
   * Check if text appears to be encrypted
   */
  static isEncrypted(text: string): boolean {
    if (!text || text.trim() === '') return false;
    
    const parts = text.split(':');
    return parts.length === 4 && parts.every(part => {
      try {
        Buffer.from(part, 'base64');
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Create placeholder for sensitive data display
   */
  static createPlaceholder(length: number = 8): string {
    return '•'.repeat(length);
  }

  /**
   * Check if a value is a placeholder (contains only bullet characters)
   */
  static isPlaceholder(value: string): boolean {
    return value.length > 0 && /^•+$/.test(value);
  }
}