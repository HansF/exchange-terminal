import type { Page } from '@playwright/test';

/**
 * Stub navigator.mediaDevices.getUserMedia with a stream from a colored
 * canvas. Runs in headless chromium without Chrome's fake-media-stream flag
 * (which only works in headed builds).
 */
export async function injectFakeCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fakeStream = (): MediaStream => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      // Draw something non-trivial so threshold/conversion has real data.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(100, 100, 200, 200);
      // Re-draw on a tick so the video element has fresh frames; capturing a
      // static canvas works for one frame, which is all StencilCam needs.
      const stream = (
        canvas as HTMLCanvasElement & {
          captureStream(frameRate?: number): MediaStream;
        }
      ).captureStream(30);
      return stream;
    };

    const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...mediaDevices,
        getUserMedia: async () => fakeStream(),
        enumerateDevices: async () => [
          {
            kind: 'videoinput',
            deviceId: 'fake',
            groupId: 'fake',
            label: 'fake',
          } as MediaDeviceInfo,
        ],
      },
    });
  });
}
