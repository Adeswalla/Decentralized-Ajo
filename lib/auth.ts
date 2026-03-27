import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const JWT_EXPIRATION = '1h';
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export interface JWTPayload {
  userId: string;
  email: string;
  walletAddress?: string;
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

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });
}

export function getRefreshTokenExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}

export function isSecureCookieEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: getRefreshTokenExpiryDate(),
    },
  });
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ token: string; userId: string } | null> {
  const existingToken = await prisma.refreshToken.findUnique({
    where: { token },
    select: { token: true, userId: true, expiresAt: true },
  });

  if (!existingToken || existingToken.expiresAt <= new Date()) {
    if (existingToken) {
      await prisma.refreshToken.delete({ where: { token: existingToken.token } });
    }
    return null;
  }

  const newToken = crypto.randomUUID();

  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token: existingToken.token } }),
    prisma.refreshToken.create({
      data: {
        token: newToken,
        userId: existingToken.userId,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    }),
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
  } catch (error) {
    return null;
  }
}

// Decode JWT token without verification (for debugging)
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
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
