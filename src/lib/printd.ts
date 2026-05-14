/**
 * Typed client for the printd HTTP API (https://github.com/HansF/printd).
 *
 * The webapp talks to printd via the same-origin Node proxy in `server.cjs`,
 * which holds the bearer key server-side. Paths here are the printd API
 * paths prefixed with `/api`, e.g. `/print` → `/api/print`.
 */

const BASE = '/api';

export interface PrintOptions {
  cut?: boolean;
  feed?: number;
  partial_cut?: boolean;
}

export interface PrintResult {
  ok: true;
  width: number;
  height: number;
}

export interface HealthResult {
  ok: boolean;
  printer: string;
  kind: string;
  target: string;
}

export interface StatusResult {
  ok: boolean;
  kind: string;
  target: string;
  last_error: string | null;
  print_width: number;
  bottom_pad_rows: number;
  feed_before_cut: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok || (body as { error?: string })?.error) {
    const err = (body as { error?: string })?.error || `HTTP ${res.status}`;
    throw new Error(`printd ${path}: ${err}`);
  }
  return body as T;
}

export const printd = {
  /** Liveness probe — does not require auth. */
  health(): Promise<HealthResult> {
    return call<HealthResult>('/healthz');
  },

  /** Connector kind, last error, image-pipeline settings. */
  status(): Promise<StatusResult> {
    return call<StatusResult>('/status');
  },

  /** Send a base64 / data-URL PNG to the printer. */
  print(image: string, opts: PrintOptions = {}): Promise<PrintResult> {
    return call<PrintResult>('/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The Node proxy expects { imageData, cut } — keep that shape so the
      // server.cjs proxy doesn't need to know about new field names.
      body: JSON.stringify({ imageData: image, cut: opts.cut ?? true }),
    });
  },

  /** Feed paper N lines without cutting. */
  feed(lines: number): Promise<{ ok: true }> {
    return call<{ ok: true }>('/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    });
  },

  /** Cut the paper. */
  cut(partial = false): Promise<{ ok: true }> {
    return call<{ ok: true }>('/cut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partial }),
    });
  },
};
