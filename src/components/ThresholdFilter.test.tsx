import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThresholdFilter } from './ThresholdFilter';

// JSDOM has no canvas. Stub the bits the component touches and let us assert
// that the threshold pipeline ran end-to-end.
const mockPrint = vi.fn();
vi.mock('../lib/printd', () => ({
  printd: {
    print: (...args: unknown[]) => mockPrint(...args),
  },
}));

type FakeCtx = {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
};

let fakeCtx: FakeCtx;
let imageInstances: FakeImage[] = [];

class FakeImage {
  crossOrigin = '';
  width = 4;
  height = 1;
  onload: (() => void) | null = null;
  // Setting src triggers onload on the next microtask, mirroring browser behavior
  // closely enough for tests.
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  imageInstances = [];
  fakeCtx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      // 4 pixels: black, mid-grey-ish (luma 128), bright, near-white
      data: new Uint8ClampedArray([
        10, 10, 10, 255, 128, 128, 128, 255, 200, 200, 200, 255, 250, 250, 250, 255,
      ]),
      width: 4,
      height: 1,
      colorSpace: 'srgb' as const,
    })),
    putImageData: vi.fn(),
  };

  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => fakeCtx,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,STUB');

  vi.stubGlobal(
    'Image',
    class extends FakeImage {
      constructor() {
        super();
        imageInstances.push(this);
      }
    },
  );

  mockPrint.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flushImageLoad = async () => {
  // Let the queued microtask (Image.onload) and React effects settle.
  await act(async () => {
    await Promise.resolve();
  });
};

describe('<ThresholdFilter />', () => {
  it('renders the slider, redo, export, and print controls', () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print stencil/i })).toBeInTheDocument();
  });

  it('shows the default threshold percentage (50%) on first render', () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('exposes the full 0–255 slider range', () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('255');
  });

  it('runs the threshold pipeline once the image loads and disables print until then', async () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    const printBtn = screen.getByRole('button', { name: /print stencil/i });
    expect(printBtn).toBeDisabled();

    await flushImageLoad();

    await waitFor(() => {
      expect(fakeCtx.drawImage).toHaveBeenCalled();
      expect(fakeCtx.putImageData).toHaveBeenCalled();
    });
    expect(printBtn).not.toBeDisabled();
  });

  it('writes thresholded pixel data back to the canvas', async () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    await flushImageLoad();
    await waitFor(() => expect(fakeCtx.putImageData).toHaveBeenCalled());

    const written = fakeCtx.putImageData.mock.calls[0][0] as ImageData;
    // With default threshold 128, pixels with luma >= 128 become white.
    // Pixel 0 (10,10,10) → black; pixel 1 (128,128,128) → white (>=);
    // pixels 2 and 3 → white. Alpha preserved.
    expect(Array.from(written.data)).toEqual([
      0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    ]);
  });

  it('updates the displayed percentage when the slider moves', () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '64' } });
    // 64/255 ≈ 25%
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('reprocesses the image when the threshold changes', async () => {
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    await flushImageLoad();
    await waitFor(() => expect(fakeCtx.putImageData).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    await flushImageLoad();
    await waitFor(() => expect(fakeCtx.putImageData).toHaveBeenCalledTimes(2));

    // threshold 0: every pixel becomes white.
    const second = fakeCtx.putImageData.mock.calls[1][0] as ImageData;
    for (let i = 0; i < second.data.length; i += 4) {
      expect(second.data[i]).toBe(255);
      expect(second.data[i + 1]).toBe(255);
      expect(second.data[i + 2]).toBe(255);
    }
  });

  it('invokes onRedo when the redo button is clicked', async () => {
    const onRedo = vi.fn();
    render(<ThresholdFilter imageSrc="image.png" onRedo={onRedo} />);
    await userEvent.click(screen.getByRole('button', { name: /redo/i }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('sends the rendered data URL to printd when print is clicked', async () => {
    mockPrint.mockResolvedValue(undefined);
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    await flushImageLoad();
    const printBtn = await screen.findByRole('button', { name: /print stencil/i });
    await waitFor(() => expect(printBtn).not.toBeDisabled());

    await userEvent.click(printBtn);

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    expect(mockPrint).toHaveBeenCalledWith('data:image/png;base64,STUB');
    await screen.findByRole('button', { name: /sent/i });
  });

  it('surfaces a print error in the button label when printd rejects', async () => {
    mockPrint.mockRejectedValue(new Error('printer offline'));
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    await flushImageLoad();
    const printBtn = await screen.findByRole('button', { name: /print stencil/i });
    await waitFor(() => expect(printBtn).not.toBeDisabled());

    await userEvent.click(printBtn);

    const errorBtn = await screen.findByRole('button', { name: /^error$/i });
    expect(errorBtn).toHaveAttribute('title', 'printer offline');
  });

  it('does nothing if the canvas 2d context is unavailable', async () => {
    (HTMLCanvasElement.prototype.getContext as unknown as ReturnType<typeof vi.fn>) = vi.fn(
      () => null,
    );
    render(<ThresholdFilter imageSrc="image.png" onRedo={() => {}} />);
    await flushImageLoad();
    expect(fakeCtx.drawImage).not.toHaveBeenCalled();
    expect(fakeCtx.putImageData).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /print stencil/i })).toBeDisabled();
  });
});
