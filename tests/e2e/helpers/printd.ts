import type { Page, Route } from '@playwright/test';

export interface CapturedPrint {
  imageData: string;
  cut: boolean;
  width: number;
  height: number;
}

export interface PrintdMock {
  /** Print payloads received, in order. */
  prints: CapturedPrint[];
  /** Number of /api/cut calls. */
  cuts: number;
  /** Number of /api/feed calls (with line counts). */
  feeds: number[];
}

/**
 * Mock the printd HTTP surface that the webapp talks to via the Node proxy.
 * Intercepts at the browser fetch layer, so the Express proxy + real printd
 * never have to be running. Pass `failPrint` to simulate a printer error.
 */
export async function mockPrintd(
  page: Page,
  opts: { failPrint?: boolean; failCaricature?: boolean } = {}
): Promise<PrintdMock> {
  const state: PrintdMock = { prints: [], cuts: 0, feeds: [] };

  await page.route('**/api/print', async (route: Route) => {
    const body = route.request().postDataJSON() as { imageData?: string; cut?: boolean };
    const imageData = body?.imageData ?? '';
    if (!imageData.startsWith('data:image/')) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Missing or invalid imageData field' }),
      });
    }
    if (opts.failPrint) {
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'printd unreachable: simulated failure' }),
      });
    }
    // Best-effort dimensions from the data URL header (mostly unused by the app).
    state.prints.push({ imageData, cut: body.cut ?? true, width: 570, height: 0 });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ok: true, width: 570, height: 100 }),
    });
  });

  await page.route('**/api/cut', async (route: Route) => {
    state.cuts += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/feed', async (route: Route) => {
    const body = route.request().postDataJSON() as { lines?: number };
    state.feeds.push(body?.lines ?? 3);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/status', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        kind: 'dummy',
        target: 'mock',
        last_error: null,
        print_width: 570,
        bottom_pad_rows: 0,
        feed_before_cut: 3,
      }),
    })
  );

  await page.route('**/api/healthz', async (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, printer: 'mock', kind: 'dummy', target: 'mock' }),
    })
  );

  await page.route('**/api/caricature', async (route: Route) => {
    if (opts.failCaricature) {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated caricature failure' }),
      });
    }
    // 1x1 white PNG — enough to flow through the threshold canvas step.
    const onePixelPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ imageData: onePixelPng }),
    });
  });

  return state;
}

/** Quick assertion: the value looks like a base64-encoded PNG data URL. */
export function isPngDataUrl(s: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length > 80;
}
