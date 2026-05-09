import { test, expect } from '@playwright/test';
import { mockPrintd, isPngDataUrl } from './helpers/printd';
import { injectFakeCamera } from './helpers/camera';

test.describe('StencilCam → caricature → print pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeCamera(page);
  });

  test('captures, calls Gemini proxy, thresholds, and prints', async ({ page }) => {
    const printd = await mockPrintd(page);

    await page.goto('/');
    await page.getByRole('button', { name: /stencilcam/i }).click();
    await expect(page.getByRole('heading', { name: 'STENCILCAM' })).toBeVisible();

    await page.waitForFunction(() => {
      const v = document.querySelector('video') as HTMLVideoElement | null;
      return !!v && v.videoWidth > 0 && v.videoHeight > 0;
    }, undefined, { timeout: 15_000 });

    // Shutter button is the only <button> nested inside the camera frame.
    await page.locator('video').locator('xpath=ancestor::div[1]').locator('button').click();

    await expect(page.getByRole('heading', { name: /printed!/i })).toBeVisible({ timeout: 20_000 });

    expect(printd.prints).toHaveLength(1);
    expect(isPngDataUrl(printd.prints[0].imageData)).toBe(true);
  });

  test('surfaces caricature failures as a recoverable error', async ({ page }) => {
    const printd = await mockPrintd(page, { failCaricature: true });

    await page.goto('/');
    await page.getByRole('button', { name: /stencilcam/i }).click();

    await page.waitForFunction(() => {
      const v = document.querySelector('video') as HTMLVideoElement | null;
      return !!v && v.videoWidth > 0;
    }, undefined, { timeout: 15_000 });

    await page.locator('video').locator('xpath=ancestor::div[1]').locator('button').click();

    await expect(page.getByRole('heading', { name: /system failure/i })).toBeVisible({ timeout: 15_000 });
    expect(printd.prints).toHaveLength(0);

    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.locator('video')).toBeVisible();
  });
});
