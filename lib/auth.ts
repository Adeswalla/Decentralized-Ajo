import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const JWT_EXPIRATION = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export type TokenType = 'user' | 'service';

export interface JWTPayload {
  userId?: string; // Optional for service tokens
  email?: string;  // Optional for service tokens
  walletAddress?: string;
  type: TokenType;
  scopes: string[];
  serviceName?: string; // Only for service tokens
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT access token for users
export function generateToken(user: { id: string; email: string; walletAddress?: string | null }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    walletAddress: user.walletAddress || undefined,
    type: 'user',
    scopes: ['user:base'], // Default scope for all registered users
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });
}

/**
 * Generate a long-lived service token for internal sub-services.
 * Service tokens are stateless and authorized via specific scopes.
 */
export function generateServiceToken(serviceName: string, scopes: string[]): string {
  const payload: JWTPayload = {
    serviceName,
    type: 'service',
    scopes,
  };

  // Service tokens are usually long-lived or non-expiring for internal use
  return jwt.sign(payload, JWT_SECRET);
}

export function getRefreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}

export function isSecureCookieEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function generateRefreshToken(userId: string, familyId?: string): Promise<string> {
  const token = crypto.randomUUID();
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      familyId,
      expiresAt: getRefreshTokenExpiryDate(),
    },
  });
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ token: string; userId: string } | null> {
  const existingToken = await prisma.refreshToken.findUnique({
    where: { token },
    select: { token: true, userId: true, expiresAt: true, rotatedAt: true, familyId: true },
  });

  // If token doesn't exist or is expired
  if (!existingToken || existingToken.expiresAt <= new Date()) {
    return null;
  }

  // REUSE DETECTION: If token was already rotated, someone is trying to reuse an old token.
  // Invalidate the entire family for security.
  if (existingToken.rotatedAt) {
    await prisma.refreshToken.deleteMany({
      where: { familyId: existingToken.familyId },
    });
    return null;
  }

  const newToken = crypto.randomUUID();

  // Mark current token as rotated and create new one in the same family
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { token: existingToken.token },
      data: { rotatedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        token: newToken,
        userId: existingToken.userId,
        familyId: existingToken.familyId,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    }),
    // Cleanup old rotated tokens in this family (keep only the last one for reuse detection)
    // Actually, we should probably keep them for a short while or just delete very old ones.
    // For now, let's just keep the chain.
  ]);

  return { token: newToken, userId: existingToken.userId };
}

export async function revokeUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

// Decode JWT token without verification (for debugging)
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

// Extract token from Authorization header
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return null;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
