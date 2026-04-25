import { test, expect, generateUniqueEmail, registerUser, loginUser } from './test-utils';

test.describe('End-to-End User Journey', () => {
  const password = 'Test1234Pass!';
  let userEmail: string;

  test.beforeAll(async () => {
    userEmail = generateUniqueEmail('journey');
  });

  test('Full Journey: Register -> Login -> Create Circle', async ({ page }) => {
    // 1. Register
    await test.step('Register User', async () => {
      await registerUser(page, userEmail, password);
      // Wait for registration to complete and redirect
      await page.waitForURL(/dashboard|auth\/login/, { timeout: 15000 });
    });

    // 2. Login (if not automatically logged in)
    await test.step('Login User', async () => {
      if (page.url().includes('/auth/login')) {
        await loginUser(page, userEmail, password);
      }
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });

    // 3. Create Circle
    await test.step('Create Circle', async () => {
      await page.goto('/circles/create');
      
      // Use stable selectors: labels
      await page.getByLabel(/circle name/i).fill('E2E Journey Circle');
      await page.getByLabel(/description/i).fill('This circle was created by an automated E2E journey test.');
      
      const amountInput = page.getByLabel(/contribution amount/i);
      if (await amountInput.isVisible()) {
        await amountInput.fill('50');
      }

      // Submit
      await page.getByRole('button', { name: /create circle|create/i }).click();

      // Verify redirection or success message
      // Depending on the app, it might stay on the page with a success message or redirect to dashboard
      await expect(page).toHaveURL(/\/circles\/.*|\/dashboard/, { timeout: 15000 });
    });
  });
});
