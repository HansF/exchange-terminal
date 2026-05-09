import html2canvas from 'html2canvas';
import { printd } from './printd';

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

/** Render a DOM element to a 570 px wide, 1-bit-thresholded PNG data URL. */
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

/** Capture and print a ticket element. Throws on transport or printer error. */
export async function printTicket(el: HTMLElement, opts: { cut?: boolean } = {}): Promise<void> {
  const imageData = await captureTicketPng(el);
  await printd.print(imageData, { cut: opts.cut ?? true });
}

// Re-export the full client so pages can reach feed/cut/status without importing two files.
export { printd } from './printd';
