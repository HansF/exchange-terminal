import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Printer } from 'lucide-react';
import { printd } from '../lib/printd';
import { applyThreshold, MAX_THRESHOLD, MIN_THRESHOLD, thresholdPercent } from '../lib/threshold';

interface ThresholdFilterProps {
  imageSrc: string;
  onRedo: () => void;
}

type PrintStatus = 'idle' | 'loading' | 'success' | 'error';

export const ThresholdFilter: React.FC<ThresholdFilterProps> = ({ imageSrc, onRedo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle');
  const [printError, setPrintError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyThreshold(imageData.data, threshold);
      ctx.putImageData(imageData, 0, 0);
      setOutputUrl(canvas.toDataURL('image/png'));
    };
  }, [imageSrc, threshold]);

  const download = () => {
    if (!outputUrl) return;
    const link = document.createElement('a');
    link.download = 'stencil-caricature.png';
    link.href = outputUrl;
    link.click();
  };

  const handlePrint = async () => {
    if (!outputUrl) return;
    setPrintStatus('loading');
    setPrintError('');
    try {
      await printd.print(outputUrl);
      setPrintStatus('success');
      setTimeout(() => setPrintStatus('idle'), 3000);
    } catch (err) {
      setPrintStatus('error');
      setPrintError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] aspect-square overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="flex flex-col gap-4 bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between font-black text-sm tracking-tighter uppercase mb-2">
          <span>Threshold</span>
          <span>{thresholdPercent(threshold)}%</span>
        </div>
        <input
          type="range"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          className="w-full h-4 bg-gray-200 appearance-none border-2 border-black cursor-pointer accent-black mb-4"
        />

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onRedo}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-black border-4 border-black font-black uppercase tracking-tighter hover:bg-gray-100 active:translate-y-1 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <RefreshCw className="w-5 h-5" />
            Redo
          </button>
          <button
            onClick={download}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#38bdf8] text-black border-4 border-black font-black uppercase tracking-tighter hover:bg-sky-300 active:translate-y-1 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>

        <button
          onClick={handlePrint}
          disabled={printStatus === 'loading' || !outputUrl}
          className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 border-4 border-black font-black uppercase tracking-tighter active:translate-y-1 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed ${printStatus === 'error' ? 'bg-red-400 text-black' : 'bg-[#22c55e] text-black'}`}
          title={printStatus === 'error' ? printError : 'Print to thermal printer'}
        >
          <Printer className="w-5 h-5" />
          {printStatus === 'loading'
            ? 'Printing…'
            : printStatus === 'success'
              ? 'Sent!'
              : printStatus === 'error'
                ? 'Error'
                : 'Print Stencil'}
        </button>
      </div>
    </div>
  );
};
