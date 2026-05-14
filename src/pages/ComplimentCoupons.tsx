import { ArrowLeft, Sparkles, Printer, RefreshCw, Copy, Trash2 } from 'lucide-react';
import React, { useState, useRef, useCallback } from 'react';
import { printTicket } from '../lib/print';

interface Props {
  onBack: () => void;
}

interface Coupon {
  id: string;
  name: string;
  category: string;
  message: string;
  border: string;
  number: number;
  expires: string;
}

const COUPONS = [
  // ── compliments ──
  { c: 'brilliant', m: 'You are genuinely brilliant and the world is better because you figured it out.' },
  { c: 'brilliant', m: 'Your brain is a superpower. Please use it responsibly.' },
  { c: 'brilliant', m: 'The thing you just did was incredibly smart. Well done.' },
  { c: 'kind', m: 'You are the kind of person who makes other people\'s days better without even trying.' },
  { c: 'kind', m: 'Your kindness is your superpower — never undervalue it.' },
  { c: 'kind', m: 'You have the rare gift of making people feel seen and heard.' },
  { c: 'energy', m: 'Your energy is absolutely contagious — in the best possible way.' },
  { c: 'energy', m: 'The room literally gets better when you walk in.' },
  { c: 'energy', m: 'You bring a spark to everything you touch. Keep glowing.' },
  { c: 'creative', m: 'Your creativity is not just impressive — it is genuinely inspiring.' },
  { c: 'creative', m: 'You see the world differently, and that is a beautiful thing.' },
  { c: 'creative', m: 'The way you think about problems is a work of art.' },
  { c: 'strength', m: 'You have handled hard things before, and you will handle this too.' },
  { c: 'strength', m: 'Your resilience is quietly extraordinary. People notice.' },
  { c: 'strength', m: 'You are stronger than you give yourself credit for.' },
  { c: 'funny', m: 'You are genuinely funny. Your laugh is the best sound in the room.' },
  { c: 'funny', m: 'You have a rare gift — you make hard things feel easy and fun.' },
  { c: 'funny', m: 'If wit were currency, you would be a billionaire.' },
  { c: 'trust', m: 'People trust you instinctively, and that says everything about who you are.' },
  { c: 'trust', m: 'You are the kind of person others would move mountains for.' },
  { c: 'trust', m: 'Your word means something. In a world that forgets that, you remember.' },
  // ── absurd ──
  { c: 'absurd', m: 'You have officially been rated as being cooler than a cucumber wearing sunglasses.' },
  { c: 'absurd', m: 'Scientists confirm: you are 100% more awesome than average.' },
  { c: 'absurd', m: 'This coupon proves you are a certified legend. No further proof needed.' },
  { c: 'absurd', m: 'You are officially rated as being way too cool for this receipt.' },
  { c: 'absurd', m: 'Warning: excessive awesomeness detected. Side effects may include smiling.' },
];

const BORDERS = [
  '🟦  🟦  🟦  🟦  🟦',
  '🟨  🟨  🟨  🟨  🟨',
  '🟪  🟪  🟪  🟪  🟪',
  '🟩  🟩  🟩  🟩  🟩',
  '⬛  ⬛  ⬛  ⬛  ⬛',
  '🟧  🟧  🟧  🟧  🟧',
];

function makeCoupon(name: string): Coupon {
  const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  return {
    id: crypto.randomUUID(),
    name,
    category: pick(COUPONS).c,
    message: pick(COUPONS).m,
    border: pick(BORDERS),
    number: Math.floor(Math.random() * 900000) + 100000,
    expires: new Date(Date.now() + 30 * 86400000)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

// ── single coupon ticket ──

function CouponTicket({ coupon, onPrint, onDelete }: {
  coupon: Coupon;
  onPrint: (el: HTMLDivElement) => void;
  onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (ref.current) onPrint(ref.current);
  };

  const handleCopy = () => {
    const text = `🎟️ Compliment for ${coupon.name}\n\n${coupon.message}\n\n— Compliment Coupons —`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        className="bg-white text-black font-mono w-[320px] p-5 box-border"
        style={{
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'auto',
        }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-0.5">✦ ✦ ✦</div>
          <div className="text-lg font-black uppercase tracking-tighter">Compliment Coupons</div>
        </div>

        {/* Coupon body */}
        <div className="border-4 border-black p-4 mb-3 bg-[#FFE135]">
          <div className="text-center mb-2">
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-black/60">
              {coupon.border}
            </span>
          </div>
          <div className="text-center mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-black/70">
              Coupon For: {coupon.name}
            </span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold leading-snug">
              {coupon.message}
            </p>
          </div>
          <div className="text-center mt-2">
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-black/60">
              {coupon.border}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-dashed border-black my-3" />

        {/* Footer */}
        <div className="flex justify-between text-[10px] font-bold text-black/60 mb-3">
          <span>#{coupon.number}</span>
          <span>Exp: {coupon.expires}</span>
        </div>

        {/* Tear line */}
        <div className="border-t-2 border-dashed border-black pt-2">
          <div className="text-center text-[9px] font-bold uppercase tracking-widest text-black/60">
            ─── Tear here ───
          </div>
          <div className="text-center text-[10px] font-bold mt-1.5">
            Redeem by reading aloud to the recipient with full sincerity.
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-1.5 bg-black text-[#FFE135] border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-1.5 bg-white border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          title="Copy to clipboard"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(coupon.id)}
          className="flex items-center justify-center gap-1.5 bg-white border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all text-red-600"
          title="Delete coupon"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── main page ──

export default function ComplimentCoupons({ onBack }: Props) {
  const [name, setName] = useState('');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const [generating, setGenerating] = useState(false);
  const printAllRef = useRef<HTMLDivElement>(null);

  // ── actions ──

  const generate = () => {
    const n = name.trim();
    if (!n) return;
    setGenerating(true);
    setTimeout(() => {
      setCoupons(prev => [makeCoupon(n), ...prev]);
      setGenerating(false);
    }, 600);
  };

  const printCoupon = useCallback(async (el: HTMLDivElement) => {
    setPrinting(true);
    setPrintError('');
    // Wait for React to settle
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      await printTicket(el);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }, []);

  const printAll = useCallback(async () => {
    if (coupons.length === 0) return;
    setPrinting(true);
    setPrintError('');
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      await printTicket(printAllRef.current!);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }, [coupons]);

  const deleteCoupon = (id: string) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  // ── render ──

  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      {/* Header */}
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
            <h1 className="text-3xl md:text-5xl font-black text-black tracking-tighter bg-[#FF90E8] border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rotate-1">
              COMPLIMENT COUPONS
            </h1>
            <p className="text-black font-bold mt-4 text-lg bg-[#E0FF4F] border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              Generate genuine compliments. Print them. Spread joy.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col gap-6">
        {/* Input + generate */}
        <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') generate(); }}
              placeholder="Whose compliment? (e.g. Alex, Team, You)"
              maxLength={40}
              className="flex-1 border-2 border-black px-4 py-3 font-mono text-sm font-bold bg-[#f8f8f8] placeholder:text-black/25 focus:outline-none focus:bg-white"
            />
            <button
              onClick={generate}
              disabled={!name.trim() || generating}
              className="flex items-center justify-center gap-2 bg-black text-[#FFE135] border-4 border-black px-6 py-3 font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
              {generating ? (
                <Sparkles className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              Generate
            </button>
          </div>
        </div>

        {/* Print controls + coupons */}
        {coupons.length > 0 && (
          <div className="flex flex-col gap-4">
            {/* Print all bar */}
            <div className="flex items-center justify-between bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-sm font-black uppercase tracking-wide">
                {coupons.length} coupon{coupons.length !== 1 ? 's' : ''} ready
              </span>
              <button
                onClick={printAll}
                disabled={printing}
                className="flex items-center gap-2 bg-[#E0FF4F] border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                Print All
              </button>
            </div>

            {/* Coupon list */}
            <div className="flex flex-col gap-4">
              {coupons.map(c => (
                <CouponTicket
                  key={c.id}
                  coupon={c}
                  onPrint={printCoupon}
                  onDelete={deleteCoupon}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {coupons.length === 0 && (
          <div className="text-center py-16 px-8">
            <div className="text-6xl mb-4">🎟️</div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">
              No coupons yet
            </h2>
            <p className="text-sm font-bold text-black/50 max-w-sm mx-auto">
              Enter a name above and hit Generate to create your first compliment coupon.
            </p>
          </div>
        )}

        {/* Error */}
        {printError && (
          <div className="bg-red-400 border-2 border-black px-4 py-2 text-xs font-bold text-center">
            ⚠ {printError}
          </div>
        )}
      </main>

      {/* ── Hidden print area: all coupons stacked ── */}
      <div className="fixed top-0 left-[-9999px] pointer-events-none" aria-hidden="true">
        <div
          ref={printAllRef}
          className="bg-white text-black font-mono w-[320px] p-5 box-border flex flex-col gap-4"
          style={{ WebkitFontSmoothing: 'none' }}
        >
          <div className="text-center border-b-2 border-black pb-2 mb-2">
            <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-0.5">✦ ✦ ✦</div>
            <div className="text-lg font-black uppercase tracking-tighter">All Coupons</div>
          </div>
          {coupons.map(c => (
            <div
              key={c.id}
              className="bg-white text-black font-mono w-[320px] p-5 box-border"
              style={{ WebkitFontSmoothing: 'none' }}
            >
              {/* Same ticket markup as CouponTicket */}
              <div className="text-center border-b-2 border-black pb-2 mb-3">
                <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-0.5">✦ ✦ ✦</div>
                <div className="text-lg font-black uppercase tracking-tighter">Compliment Coupons</div>
              </div>
              <div className="border-4 border-black p-4 mb-3 bg-[#FFE135]">
                <div className="text-center mb-2">
                  <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-black/60">{c.border}</span>
                </div>
                <div className="text-center mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/70">Coupon For: {c.name}</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold leading-snug">{c.message}</p>
                </div>
                <div className="text-center mt-2">
                  <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-black/60">{c.border}</span>
                </div>
              </div>
              <div className="border-t-2 border-dashed border-black my-3" />
              <div className="flex justify-between text-[10px] font-bold text-black/60 mb-3">
                <span>#{c.number}</span>
                <span>Exp: {c.expires}</span>
              </div>
              <div className="border-t-2 border-dashed border-black pt-2">
                <div className="text-center text-[9px] font-bold uppercase tracking-widest text-black/60">─── Tear here ───</div>
                <div className="text-center text-[10px] font-bold mt-1.5">Redeem by reading aloud to the recipient with full sincerity.</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
