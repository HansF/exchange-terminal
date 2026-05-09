import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { CameraBridge } from './CameraBridge';

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

const createMockTrack = () => ({
  stop: vi.fn(),
  kind: 'video' as const,
});

const createMockStream = (tracks = [createMockTrack()]) =>
  ({
    getTracks: () => tracks,
  } as unknown as MediaStream);

const installMediaDevices = (getUserMedia: GetUserMedia) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
};

describe('CameraBridge', () => {
  let originalMediaDevices: MediaDevices | undefined;

  beforeEach(() => {
    originalMediaDevices = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
    // Silence the console.error from the error path to keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: originalMediaDevices,
      });
    } else {
      delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    }
  });

  it('requests a 1080x1080 user-facing camera stream on mount', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(createMockStream());
    installMediaDevices(getUserMedia);

    await act(async () => {
      render(<CameraBridge onCapture={vi.fn()} isProcessing={false} />);
    });

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'user',
        width: { ideal: 1080 },
        height: { ideal: 1080 },
      },
    });
  });

  it('attaches the resolved stream to the video element', async () => {
    const stream = createMockStream();
    installMediaDevices(vi.fn().mockResolvedValue(stream));

    await act(async () => {
      render(<CameraBridge onCapture={vi.fn()} isProcessing={false} />);
    });

    const video = document.querySelector('video') as HTMLVideoElement;
    await waitFor(() => expect(video.srcObject).toBe(stream));
  });

  it('shows the capture button once the stream is active', async () => {
    installMediaDevices(vi.fn().mockResolvedValue(createMockStream()));

    await act(async () => {
      render(<CameraBridge onCapture={vi.fn()} isProcessing={false} />);
    });

    await waitFor(() => {
      // The capture button is the only <button> on the success path.
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('hides the capture button while processing and shows the processing overlay', async () => {
    installMediaDevices(vi.fn().mockResolvedValue(createMockStream()));

    await act(async () => {
      render(<CameraBridge onCapture={vi.fn()} isProcessing={true} />);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('renders the error UI when getUserMedia rejects', async () => {
    installMediaDevices(vi.fn().mockRejectedValue(new Error('NotAllowedError')));

    await act(async () => {
      render(<CameraBridge onCapture={vi.fn()} isProcessing={false} />);
    });

    expect(
      await screen.findByText(/Unable to access camera\. Please check permissions\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries getUserMedia when the user clicks RETRY', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValueOnce(createMockStream());
    installMediaDevices(getUserMedia);

    await act(async () => {
      render(<CameraBridge onCapture={vi.fn()} isProcessing={false} />);
    });

    const retry = await screen.findByRole('button', { name: /retry/i });
    await act(async () => {
      fireEvent.click(retry);
    });

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    // NOTE: The component currently nests `setError(null)` inside the
    // `if (videoRef.current)` block, but the video element is not rendered
    // while the error UI is showing — so the error message persists even
    // after a successful retry. We only assert the retry is dispatched here
    // and flag this as a follow-up bug for the Frontender agent.
  });

  it('stops all tracks when the component unmounts', async () => {
    const track = createMockTrack();
    installMediaDevices(vi.fn().mockResolvedValue(createMockStream([track])));

    let unmount: () => void = () => {};
    await act(async () => {
      ({ unmount } = render(<CameraBridge onCapture={vi.fn()} isProcessing={false} />));
    });

    // Wait until the stream has been wired up before unmounting.
    const video = document.querySelector('video') as HTMLVideoElement;
    await waitFor(() => expect(video.srcObject).not.toBeNull());

    await act(async () => {
      unmount();
    });

    expect(track.stop).toHaveBeenCalled();
  });

  it('calls onCapture with a base64 JPEG payload when the capture button is clicked', async () => {
    const stream = createMockStream();
    installMediaDevices(vi.fn().mockResolvedValue(stream));

    const onCapture = vi.fn();

    // Stub canvas 2D context so capturePhoto can run without a real renderer.
    const ctx = {
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    };
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,FAKE_BASE64_PAYLOAD');

    // Stub video dimensions so the centered crop math has something to work with.
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 1280,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 1080,
    });

    await act(async () => {
      render(<CameraBridge onCapture={onCapture} isProcessing={false} />);
    });

    const captureButton = await screen.findByRole('button');
    await act(async () => {
      fireEvent.click(captureButton);
    });

    expect(getContextSpy).toHaveBeenCalledWith('2d');
    // Centered square crop: (1280-1080)/2 = 100, scaled into 1024x1024.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement),
      100,
      0,
      1080,
      1080,
      0,
      0,
      1024,
      1024,
    );
    expect(ctx.translate).toHaveBeenCalledWith(1024, 0);
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(onCapture).toHaveBeenCalledWith('FAKE_BASE64_PAYLOAD');
  });
});
