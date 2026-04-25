
import type { Page } from '@playwright/test';
export { test, expect, type Page } from '@playwright/test';

/**
 * Generate a unique email for test isolation
 */
export function generateUniqueEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}${timestamp}${random}@example.com`;
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Clear all cookies and storage
 */
export async function clearBrowserState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
}

/**
 * Register a new user
 */
export async function registerUser(page: Page, email: string, password = 'Test1234Pass!') {
  await page.goto('/auth/register');
  await page.getByLabel('First Name').fill('Test');
  await page.getByLabel('Last Name').fill('User');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);

  const submitBtn = page.getByRole('button', { name: /sign up/i });
  await submitBtn.click();

  // Wait for redirect to dashboard or login
  await page.waitForURL(/dashboard|auth\/login/, { timeout: 30000 });
}

/**
 * Login a user
 */
export async function loginUser(page: Page, email: string, password = 'Test1234Pass!') {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  const submitBtn = page.getByRole('button', { name: /sign in|login/i });
  await submitBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}