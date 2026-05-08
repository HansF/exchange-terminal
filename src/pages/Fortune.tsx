import { ArrowLeft, Printer, Sparkles } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { printTicket } from '../lib/print';
import { FORTUNES } from '../fortunes';

interface Props {
  onBack: () => void;
}

type PrintStatus = 'idle' | 'loading' | 'success' | 'error';

export default function Fortune({ onBack }: Props) {
  const [status, setStatus] = useState<PrintStatus>('idle');
  const [error, setError] = useState('');
  const [fortune, setFortune] = useState<string>('');
  const ticketRef = useRef<HTMLDivElement>(null);

  const printFortune = async () => {
    const drawn = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    setFortune(drawn);
    setStatus('loading');
    setError('');

    // Wait one frame for React to render the ticket with the new fortune
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      const el = ticketRef.current;
      if (!el) throw new Error('Ticket element not found');

      await printTicket(el);

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const now = new Date().toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      <header className="max-w-2xl mx-auto w-full mb-12">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 bg-white border-2 border-black font-bold px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-black tracking-tighter bg-[#FF90E8] border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-1">
              THE ORACLE
            </h1>
            <p className="text-black font-bold mt-4 text-lg bg-white border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              Press the button. Receive your truth.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full flex flex-col items-center gap-4">
        <button
          onClick={printFortune}
          disabled={status === 'loading'}
          className={`border-4 border-black font-black text-xl py-5 px-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest ${status === 'error' ? 'bg-red-400 text-black' : 'bg-black text-[#FFE135]'}`}
          title={status === 'error' ? error : 'Draw and print your fortune'}
        >
          {status === 'loading' ? <Sparkles className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
          {status === 'loading' ? 'Printing…' :
           status === 'success' ? 'Fortune Sent!' :
           status === 'error'   ? 'Error — Try Again' :
           'Draw Your Fortune'}
        </button>
        {status === 'error' && (
          <p className="text-xs font-bold bg-red-400 border-2 border-black px-3 py-1 max-w-sm text-center">{error}</p>
        )}
      </div>

      {/* Hidden fortune ticket — rendered off-screen for html2canvas capture.
          Kept light (thin borders, no solid black fills, normal weights) so
          the thermal head doesn't overload on dense raster — see
          printer/README.md "Cut alignment & feed timing". */}
      <div className="fixed top-0 left-[-9999px] pointer-events-none" aria-hidden="true">
        <div
          ref={ticketRef}
          className="bg-white text-black font-mono w-[320px] p-5 box-border"
          style={{ fontSmoothing: 'none', WebkitFontSmoothing: 'none' } as React.CSSProperties}
        >
          {/* Header */}
          <div className="text-center border-b border-black pb-3 mb-5">
            <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-1">✦ ✦ ✦</div>
            <div className="text-2xl font-bold uppercase tracking-tight">THE ORACLE</div>
            <div className="text-[10px] font-bold tracking-widest mt-1">YOUR FORTUNE AWAITS</div>
          </div>

          {/* Fortune text */}
          <div className="mb-6 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-dashed border-black pb-1">Prophecy</div>
            <p className="text-base font-bold leading-snug italic">{fortune}</p>
          </div>

          {/* Decorative divider */}
          <div className="text-center text-sm font-bold my-4 tracking-widest">
            — ✦ —
          </div>

          {/* Footer */}
          <div className="border-t border-black pt-3 text-center">
            <div className="text-[10px] font-bold mb-2">{now}</div>
            <div className="text-[11px] font-bold tracking-widest uppercase">— Oracle Dispatch —</div>
          </div>
        </div>
      </div>
    </div>
  );
}
