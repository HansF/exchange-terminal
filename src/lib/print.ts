import html2canvas from 'html2canvas';

export const PRINT_WIDTH_PX = 570;

function resizeCanvasExact(src: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  const targetHeight = Math.round((src.height * targetWidth) / src.width);
  const out = document.createElement('canvas');
  out.width = targetWidth;
  out.height = targetHeight;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, targetWidth, targetHeight);
  return out;
}

export async function captureTicketPng(el: HTMLElement): Promise<string> {
  const cssWidth = el.offsetWidth;
  const scale = PRINT_WIDTH_PX / cssWidth;
  const canvas = await html2canvas(el, { scale, backgroundColor: '#FFFFFF', logging: false });

  const out = canvas.width === PRINT_WIDTH_PX ? canvas : resizeCanvasExact(canvas, PRINT_WIDTH_PX);

  const ctx = out.getContext('2d')!;
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const b = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = b > 128 ? 255 : 0;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}

export async function printTicket(el: HTMLElement, opts: { cut?: boolean } = {}): Promise<void> {
  const imageData = await captureTicketPng(el);
  const res = await fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, cut: opts.cut ?? true }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
}
