import { ArrowLeft, Printer, Download, Sparkles, RefreshCw, Heart } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import { printTicket } from '../lib/print';

interface Props {
  onBack: () => void;
}

type AppState = 'IDLE' | 'GENERATING' | 'READY' | 'PRINTING' | 'ERROR';

// ── Seeded PRNG (Mulberry32) ────────────────────────────────────────────────
// Same input text always produces the same pattern.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

// ── Pattern generation ──────────────────────────────────────────────────────
// Creates a tapestry pattern on an offscreen canvas.

function generateWeave(
  canvas: HTMLCanvasElement,
  offers: string[],
  demands: string[],
  matches: Array<[number, number]>,
  seed: number,
): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const rand = mulberry32(seed);

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  const threadSpacing = 4;
  const threadWidth = 2;
  const half = Math.floor(threadSpacing / 2);

  // Collect all thread positions and directions
  const threads: Array<{
    x1: number; y1: number; x2: number; y2: number;
    isMatch: boolean;
  }> = [];

  // Horizontal threads (offers) — drawn as right-leaning diagonals
  offers.forEach((_, idx) => {
    const y = half + idx * threadSpacing;
    const phase = rand();
    threads.push({
      x1: -10,
      y1: y,
      x2: w + 10,
      y2: y + Math.round((w + 20) * (0.15 + phase * 0.2)),
      isMatch: false,
    });
  });

  // Vertical threads (demands) — drawn as left-leaning diagonals
  demands.forEach((_, idx) => {
    const x = half + idx * threadSpacing;
    const phase = rand();
    threads.push({
      x1: x,
      y1: -10,
      x2: x + Math.round((h + 20) * (0.15 + phase * 0.2)),
      y2: h + 10,
      isMatch: false,
    });
  });

  // Mark intersection points where matches exist
  const matchSet = new Set(matches.map(([oi, di]) => `${oi},${di}`));
  threads.forEach((t) => {
    // Check if this thread intersects a match point
    const isHT = t.y1 < t.y2 && Math.abs(t.x2 - t.x1) > 0 && Math.abs(t.y2 - t.y1) < Math.abs(t.x2 - t.x1);
    const isVT = t.x1 < t.x2 && Math.abs(t.x2 - t.x1) < Math.abs(t.y2 - t.y1);

    if (isHT) {
      // This is a horizontal (offer) thread — check against demands
      const offerIdx = Math.round((t.y1 - half) / threadSpacing);
      if (offerIdx >= 0 && offerIdx < offers.length) {
        matches.forEach(([oi, di]) => {
          if (oi === offerIdx) {
            const demandX = half + di * threadSpacing;
            const intersectY = t.y1 + (demandX - t.x1) * ((t.y2 - t.y1) / (t.x2 - t.x1));
            if (intersectY >= 0 && intersectY < h) {
              t.isMatch = true;
            }
          }
        });
      }
    }

    if (isVT) {
      const demandIdx = Math.round((t.x1 - half) / threadSpacing);
      if (demandIdx >= 0 && demandIdx < demands.length) {
        matches.forEach(([oi, di]) => {
          if (di === demandIdx) {
            const intersectX = t.x1 + (t.y1 - t.y2) * ((t.x2 - t.x1) / (t.y2 - t.y1));
            if (intersectX >= 0 && intersectX < w) {
              t.isMatch = true;
            }
          }
        });
      }
    }
  });

  // Draw threads — horizontal first (bottom layer)
  threads.forEach((t) => {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = t.isMatch ? 3 : 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  });

  // Draw match knots (diamond shapes at intersections)
  matches.forEach(([oi, di]) => {
    const oy = half + oi * threadSpacing;
    const kx = half + di * threadSpacing;
    const dy = oy + (kx + 10 - 0) * ((oy + Math.round((w + 20) * (0.15 + mulberry32(hashString(offers[oi]) + '_phase'))() * 0.2)) / (w + 20));
    // For simplicity, draw a small diamond at the approximate intersection
    const size = 3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(kx, dy - size);
    ctx.lineTo(kx + size, dy);
    ctx.lineTo(kx, dy + size);
    ctx.lineTo(kx - size, dy);
    ctx.closePath();
    ctx.fill();
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ConnectionWeave({ onBack }: Props) {
  const [state, setState] = useState<AppState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [name, setName] = useState('');

  // Weave data
  const [offers, setOffers] = useState<string[]>([]);
  const [demands, setDemands] = useState<string[]>([]);
  const [matchInput, setMatchInput] = useState('');
  const [weaveSeed, setWeaveSeed] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<HTMLDivElement>(null);

  // Add an offer
  const addOffer = () => {
    const trimmed = name.trim() || 'Anonymous';
    setOffers((prev) => [...prev, trimmed]);
    setName('');
  };

  // Add a demand
  const addDemand = () => {
    const trimmed = name.trim() || 'Anonymous';
    setDemands((prev) => [...prev, trimmed]);
    setName('');
  };

  // Add a match (linking offer index + demand index)
  const addMatch = () => {
    // Parse "offerName-demandName" or use last added of each
    const parts = matchInput.split('-');
    if (parts.length === 2 && offers.length > 0 && demands.length > 0) {
      // Find indices by name matching
      const oi = offers.findIndex((o) => o.toLowerCase() === parts[0].toLowerCase().trim());
      const di = demands.findIndex((d) => d.toLowerCase() === parts[1].toLowerCase().trim());
      if (oi >= 0 && di >= 0) {
        setDemands((prev) => [...prev, '']); // just to push
        setWeaveSeed((prev) => prev + 1);
        setMatchInput('');
      }
    }
  };

  // Generate the weave pattern
  const generateWeave = useCallback(async () => {
    if (offers.length === 0 && demands.length === 0) return;

    setState('GENERATING');
    setErrorMsg(null);

    // Compute seed from all data
    const seed = offers
      .concat(demands)
      .join('|')
      .split('')
      .reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 42) >>> 0;

    setWeaveSeed(seed);

    // Wait a frame for React to render
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const canvas = canvasRef.current;
    if (!canvas) {
      setErrorMsg('Canvas element not found');
      setState('ERROR');
      return;
    }

    // Set canvas size for thermal printing (~570px wide)
    canvas.width = 570;
    canvas.height = Math.max(400, (offers.length + demands.length) * 12);

    generateWeave(canvas, offers, demands, [], seed);

    setState('READY');
  }, [offers, demands]);

  // Print the weave
  const printWeave = async () => {
    const el = artRef.current;
    if (!el) return;

    setState('PRINTING');
    setErrorMsg(null);

    try {
      await printTicket(el);
      setState('READY');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Print failed');
      setState('ERROR');
    }
  };

  // Download the weave as PNG
  const downloadWeave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `connection-weave-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  // Reset
  const reset = () => {
    setOffers([]);
    setDemands([]);
    setName('');
    setMatchInput('');
    setWeaveSeed(0);
    setState('IDLE');
    setErrorMsg(null);
  };

  const totalThreads = offers.length + demands.length;
  const hasData = offers.length > 0 || demands.length > 0;

  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      <header className="max-w-5xl mx-auto w-full mb-8">
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
              THE CONNECTION WEAVE
            </h1>
            <p className="text-black font-bold mt-4 text-lg bg-white border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              Turn exchange threads into a shared tapestry. Every offer and demand is a thread — matches are the knots.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8 items-start flex-1">
        {/* Control Panel */}
        <div className="w-full lg:w-1/3 bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] no-print">
          <h3 className="font-black uppercase mb-4 text-lg border-b-2 border-black pb-2">Weave Controls</h3>

          {/* Input area */}
          <div className="space-y-3 mb-6">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (offers.length === 0 && demands.length === 0) {
                    addOffer();
                  } else if (demands.length === 0) {
                    addDemand();
                  } else {
                    generateWeave();
                  }
                }
              }}
              placeholder="Your name…"
              className="w-full px-4 py-2 border-2 border-black focus:ring-0 focus:outline-none focus:bg-yellow-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono"
              maxLength={40}
            />

            <div className="flex gap-2">
              {offers.length === 0 && demands.length === 0 ? (
                <button
                  onClick={addOffer}
                  className="flex-1 bg-[#E0FF4F] border-2 border-black font-bold py-2 text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  Add Offer Thread
                </button>
              ) : offers.length > 0 && demands.length === 0 ? (
                <button
                  onClick={addDemand}
                  className="flex-1 bg-[#38bdf8] border-2 border-black font-bold py-2 text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  Add Demand Thread
                </button>
              ) : null}
            </div>
          </div>

          {/* Thread counts */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-sm font-bold">
              <div className="w-3 h-3 bg-[#E0FF4F] border border-black" />
              <span>Offers: {offers.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <div className="w-3 h-3 bg-[#38bdf8] border border-black" />
              <span>Demands: {demands.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <div className="w-3 h-3 bg-[#FF90E8] border border-black" />
              <span>Total threads: {totalThreads}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {!hasData ? (
              <div className="text-xs font-bold text-gray-500 text-center border-2 border-dashed border-gray-300 p-4">
                Add at least one thread to start weaving
              </div>
            ) : (
              <>
                <button
                  onClick={generateWeave}
                  disabled={state === 'GENERATING'}
                  className="w-full bg-[#FF90E8] border-2 border-black font-bold py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {state === 'GENERATING' ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Weaving…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Weave
                    </>
                  )}
                </button>

                {state === 'READY' && (
                  <>
                    <button
                      onClick={printWeave}
                      disabled={state === 'PRINTING'}
                      className="w-full bg-[#22c55e] border-2 border-black font-bold py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4" />
                      {state === 'PRINTING' ? 'Printing…' : 'Print to Thermal'}
                    </button>
                    <button
                      onClick={downloadWeave}
                      className="w-full bg-white border-2 border-black font-bold py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download PNG
                    </button>
                  </>
                )}

                <button
                  onClick={reset}
                  className="w-full bg-gray-200 border-2 border-black font-bold py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1 text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Weave
                </button>
              </>
            )}
          </div>

          {/* Legend */}
          {state === 'READY' && (
            <div className="mt-6 border-t-2 border-black pt-4">
              <h4 className="font-black uppercase text-xs mb-2">How to read the weave</h4>
              <div className="space-y-1 text-xs font-bold">
                <p>↗ Diagonal threads = exchange participants</p>
                <p>◇ Small diamonds = where connections form</p>
                <p>The denser the weave, the more connected the community</p>
              </div>
            </div>
          )}
        </div>

        {/* Art Display */}
        <div className="w-full lg:w-2/3 flex flex-col items-center">
          {/* Status messages */}
          {state === 'ERROR' && errorMsg && (
            <div className="w-full bg-red-400 border-2 border-black p-3 mb-4 text-sm font-bold text-center">
              ⚠ {errorMsg}
            </div>
          )}

          {state === 'GENERATING' && (
            <div className="w-full bg-white border-4 border-black p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center gap-4 min-h-[300px]">
              <div className="relative">
                <div className="w-16 h-16 border-8 border-black border-t-[#FF90E8] rounded-full animate-spin" />
                <Heart className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#FF90E8]" />
              </div>
              <p className="font-black uppercase tracking-widest text-gray-500 animate-pulse">
                Pulling threads together…
              </p>
            </div>
          )}

          {state === 'READY' && (
            <div className="w-full bg-gray-200 border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              {/* Hidden print version */}
              <div className="fixed top-0 left-[-9999px] pointer-events-none" aria-hidden="true">
                <div
                  ref={artRef}
                  className="bg-white text-black font-mono w-[570px] p-6 box-border"
                  style={{ fontSmoothing: 'none', WebkitFontSmoothing: 'none' } as React.CSSProperties}
                >
                  <div className="text-center border-b border-black pb-3 mb-4">
                    <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-1">✦ ✦ ✦</div>
                    <div className="text-xl font-bold uppercase tracking-tight">CONNECTION WEAVE</div>
                    <div className="text-[10px] font-bold tracking-widest mt-1">
                      {offers.length} offers × {demands.length} demands · {totalThreads} threads
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <canvas id="print-canvas" width="440" height={Math.max(280, totalThreads * 10)} className="max-w-full" />
                  </div>
                </div>
              </div>

              {/* On-screen preview */}
              <div className="flex justify-center overflow-x-auto">
                <canvas
                  ref={canvasRef}
                  width={570}
                  height={Math.max(400, totalThreads * 12)}
                  className="max-w-full h-auto bg-white"
                />
              </div>

              <div className="text-center mt-4 text-xs font-bold text-gray-500">
                {totalThreads} threads woven into a single pattern
              </div>
            </div>
          )}

          {state === 'IDLE' && (
            <div className="w-full bg-white border-4 border-black p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center gap-6 min-h-[400px] text-center">
              <div className="text-5xl">🧵</div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Thread the Loom</h2>
                <p className="text-sm font-bold text-gray-500 max-w-md">
                  Enter your name to add an offer thread. When others add demands, a shared tapestry emerges — a visual map of community connections.
                </p>
              </div>
              <div className="border-2 border-dashed border-gray-300 p-4 max-w-sm">
                <p className="text-xs font-bold text-gray-400 uppercase">
                  Try it: add 3 offers, then 3 demands, then hit Generate
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for generation */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
