import { test, expect } from '@playwright/test';
import { mockPrintd, isPngDataUrl } from './helpers/printd';

test.describe('Fortune → print pipeline', () => {
  test('draws a fortune, captures it, and ships a PNG to printd', async ({ page }) => {
    const printd = await mockPrintd(page);

    await page.goto('/');
    await page.getByRole('button', { name: /the oracle/i }).click();
    await expect(page.getByRole('heading', { name: 'THE ORACLE' })).toBeVisible();

    await page.getByRole('button', { name: /draw your fortune/i }).click();

    await expect(page.getByRole('button', { name: /fortune sent!/i })).toBeVisible({
      timeout: 15_000,
    });

    expect(printd.prints).toHaveLength(1);
    const captured = printd.prints[0];
    expect(captured.cut).toBe(true);
    expect(isPngDataUrl(captured.imageData)).toBe(true);
  });

  test('surfaces a printer error without crashing the page', async ({ page }) => {
    await mockPrintd(page, { failPrint: true });

    await page.goto('/');
    await page.getByRole('button', { name: /the oracle/i }).click();
    await page.getByRole('button', { name: /draw your fortune/i }).click();

    await expect(page.getByRole('button', { name: /error — try again/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/printd|unreachable|simulated/i)).toBeVisible();
  });
});
