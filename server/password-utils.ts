// Password utilities for secure password hashing and comparison
// Isolated module to prevent circular dependencies

import bcrypt from "bcryptjs";

export class PasswordUtils {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a plain text password with bcrypt
   * @param password Plain text password to hash
   * @returns Promise<string> Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hash
   * @param password Plain text password
   * @param hash Hashed password to compare against
   * @returns Promise<boolean> True if passwords match
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}