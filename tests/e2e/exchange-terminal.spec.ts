import { test, expect } from '@playwright/test';
import { mockPrintd, isPngDataUrl } from './helpers/printd';

test.describe('Exchange Terminal → print pipeline', () => {
  test('builds a ticket and prints it', async ({ page }) => {
    const printd = await mockPrintd(page);

    await page.goto('/');
    await page.getByRole('button', { name: /exchange tickets/i }).click();
    await expect(page.getByRole('heading', { name: 'THE EXCHANGE TERMINAL' })).toBeVisible();

    await page.getByLabel(/Name \/ Alias/i).fill('Ada');
    await page.getByLabel(/Providing \(Offer\)/i).fill('Pickle workshops');
    await page.getByLabel(/Seeking \(Demand\)/i).fill('Old film cameras');

    // Disambiguate the "Print" button from "Get HTML" / "Get PNG" siblings.
    await page.getByTitle('Print to thermal printer').click();

    await expect(page.getByText(/^Sent!$/)).toBeVisible({ timeout: 15_000 });

    expect(printd.prints).toHaveLength(1);
    expect(printd.prints[0].cut).toBe(true);
    expect(isPngDataUrl(printd.prints[0].imageData)).toBe(true);
  });
});
