import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Camera, AlertCircle, Zap, Printer, RefreshCw } from 'lucide-react';
import { CameraBridge } from '../components/CameraBridge';

type AppState = 'IDLE' | 'ANALYZING' | 'PRINTING' | 'SUCCESS' | 'ERROR';

interface Props {
  onBack: () => void;
}

export default function StencilCam({ onBack }: Props) {
  const [state, setState] = useState<AppState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creature, setCreature] = useState<string | null>(null);

  const handleCapture = useCallback(async (base64: string) => {
    setState('ANALYZING');

    try {
      // 1. Get AI caricature from server (API key never touches client)
      const aiRes = await fetch('/api/caricature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64 }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok || aiData.error) throw new Error(aiData.error || 'AI generation failed');

      setCreature(aiData.creature ?? null);
      setState('PRINTING');

      // 2. Apply binary threshold on an offscreen canvas
      const imageData: string = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return reject(new Error('Canvas context unavailable'));
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            const v = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            const b = v >= 128 ? 255 : 0;
            px[i] = b; px[i + 1] = b; px[i + 2] = b;
          }
          ctx.putImageData(data, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load AI image'));
        img.src = aiData.imageData;
      });

      // 3. Send to printer
      const { printd } = await import('../lib/printd');
      await printd.print(imageData);

      setState('SUCCESS');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Try again?');
      setState('ERROR');
    }
  }, []);

  const reset = () => {
    setState('IDLE');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      <header className="max-w-2xl mx-auto w-full mb-8">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 bg-white border-2 border-black font-bold px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-black tracking-tighter bg-[#E0FF4F] border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              STENCILCAM
            </h1>
            <p className="text-black font-bold mt-4 text-lg bg-white border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
              AI caricature → straight to the printer. Zero grayscale.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full flex-1">
        {state === 'IDLE' && (
          <div className="space-y-6">
            <CameraBridge onCapture={handleCapture} isProcessing={false} />
            <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3">
              <Zap className="w-6 h-6 flex-shrink-0 fill-[#FFE135]" />
              <p className="text-sm font-bold uppercase leading-tight">
                Position in bright light. Press shutter — the AI draws and prints automatically.
              </p>
            </div>
          </div>
        )}

        {(state === 'ANALYZING' || state === 'PRINTING') && (
          <div className="flex flex-col items-center justify-center gap-8 py-20 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[400px]">
            <div className="relative">
              <div className="w-24 h-24 border-8 border-black border-t-[#FFE135] rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {state === 'ANALYZING' ? <Camera className="w-8 h-8" /> : <Printer className="w-8 h-8" />}
              </div>
            </div>
            <div className="text-center px-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">
                {state === 'ANALYZING' ? 'Summoning…' : 'Printing…'}
              </h2>
              <p className="font-bold uppercase tracking-widest text-gray-500 animate-pulse">
                {state === 'ANALYZING'
                  ? 'The AI is choosing your creature'
                  : creature
                    ? `You are a ${creature.toUpperCase()}`
                    : 'Sending to thermal printer'}
              </p>
            </div>
          </div>
        )}

        {state === 'SUCCESS' && (
          <div className="flex flex-col items-center justify-center gap-8 py-20 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[400px]">
            <div className="text-6xl">🖨️</div>
            <div className="text-center px-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">
                {creature ? `You are a ${creature.toUpperCase()}!` : 'Printed!'}
              </h2>
              <p className="font-bold uppercase tracking-widest text-gray-500">Check the printer.</p>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 bg-black text-[#FFE135] border-4 border-black px-8 py-4 font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 active:translate-y-1 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Next Portrait
            </button>
          </div>
        )}

        {state === 'ERROR' && (
          <div className="flex flex-col items-center justify-center gap-6 py-20 bg-red-400 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[400px] text-center px-8">
            <AlertCircle className="w-16 h-16" />
            <h2 className="text-3xl font-black uppercase tracking-tighter">System Failure</h2>
            <p className="font-bold text-lg">{errorMsg}</p>
            <button
              onClick={reset}
              className="bg-white text-black border-4 border-black px-8 py-3 font-black uppercase tracking-tighter active:translate-y-1 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
