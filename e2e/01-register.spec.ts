import { test, expect, generateUniqueEmail } from './test-utils';

test.describe('User Registration', () => {

  test('should register a new user successfully', async ({ page }) => {
    const email = generateUniqueEmail('reg');
    const password = 'Test1234Pass!';

    await page.goto('/auth/register', { waitUntil: 'networkidle' });

    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password', { exact: true }).fill(password);

    const submitBtn = page.getByRole('button', { name: /sign up|create/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page).toHaveURL(/dashboard|auth\/login/, { timeout: 15000 });
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/auth/register');

    // Submit empty form
    await page.getByRole('button', { name: /sign up|create/i }).click();

    // Check for validation errors using text content (stable)
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should show error for weak password', async ({ page }) => {
    await page.goto('/auth/register');

    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('User');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm Password', { exact: true }).fill('weak');

    await page.getByRole('button', { name: /sign up|create/i }).click();

    // Should show password strength error
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    await page.goto('/auth/register');

    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('User');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Test1234Pass!');
    await page.getByLabel('Confirm Password', { exact: true }).fill('Different1234!');

    await page.getByRole('button', { name: /sign up|create/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});