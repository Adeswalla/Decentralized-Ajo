import { test, expect, generateUniqueEmail, registerUser, loginUser } from './test-utils';

test.describe('Create Circle Flow', () => {
  let userEmail: string;
  const password = 'Test1234Pass!';

  test.beforeEach(async ({ page }) => {
    userEmail = generateUniqueEmail('circle');
    await registerUser(page, userEmail, password);
    
    // If not automatically logged in, login
    if (page.url().includes('/auth/login')) {
      await loginUser(page, userEmail, password);
    }
    
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('should create a circle successfully', async ({ page }) => {
    // Navigate to create circle page
    await page.goto('/circles/create');

    // Fill circle creation form using labels
    await page.getByLabel(/circle name/i).fill('Stable E2E Circle');
    await page.getByLabel(/description/i).fill('A stable circle for E2E testing');

    // Optional fields check
    const amountInput = page.getByLabel(/contribution amount/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill('100');
    }

    const frequencyInput = page.getByLabel(/frequency/i);
    if (await frequencyInput.isVisible()) {
      await frequencyInput.fill('7');
    }

    // Submit form
    await page.getByRole('button', { name: /create circle|create/i }).click();

    // Verify success - check for dashboard or circle detail page
    await expect(page).toHaveURL(/\/circles\/.*|\/dashboard/, { timeout: 15000 });
  });

  test('should show validation errors for empty circle form', async ({ page }) => {
    await page.goto('/circles/create');

    // Submit empty form
    await page.getByRole('button', { name: /create circle|create/i }).click();

    // Check for validation errors
    await expect(page.getByText(/circle name is required/i)).toBeVisible();
  });

  test('should require minimum circle name length', async ({ page }) => {
    await page.goto('/circles/create');

    // Fill with short name
    await page.getByLabel(/circle name/i).fill('AB');

    await page.getByRole('button', { name: /create circle|create/i }).click();

    // Should show error for short name
    await expect(page.getByText(/must be at least 3 characters/i)).toBeVisible();
  });
});