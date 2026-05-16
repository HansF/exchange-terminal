import {
  ArrowLeft,
  Trash2,
  Dice5,
  Eye,
  Printer,
  X,
  Square,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { printTicket } from '../lib/print';

interface Props {
  onBack: () => void;
}

type Tool = 'pencil' | 'eraser';
type Color = 'black' | 'white' | 'gray';

// ── helpers ───────────────────────────────────────────────────────────────

const GRID = 16;

function newGrid(): Array<Array<Color>> {
  return Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => 'white' as Color),
  );
}

function cloneGrid(g: Array<Array<Color>>): Array<Array<Color>> {
  return g.map((row) => [...row]);
}

// Seeded PRNG so "random" is reproducible per click
function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function randomizeGrid(
  grid: Array<Array<Color>>,
  density: number = 0.35,
): Array<Array<Color>> {
  const next = cloneGrid(grid);
  const rand = seededRandom(Date.now() | 0);
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (rand() < density) next[r][c] = 'black';
  return next;
}

const PALETTE: Array<{ value: Color; bg: string; ring: string; label: string }> = [
  { value: 'black', bg: '#000000', ring: '#000000', label: 'Black' },
  { value: 'gray',  bg: '#9ca3af', ring: '#6b7280', label: 'Gray' },
  { value: 'white', bg: '#ffffff', ring: '#000000', label: 'White' },
];

// ── component ─────────────────────────────────────────────────────────────

export default function PixelStudio({ onBack }: Props) {
  const [grid, setGrid] = useState<Array<Array<Color>>>(newGrid);
  const [color, setColor] = useState<Color>('black');
  const [tool, setTool] = useState<Tool>('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [printStatus, setPrintStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [printError, setPrintError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const effectiveColor = tool === 'eraser' ? 'white' : color;

  // ── grid interactions ──────────────────────────────────────────────────

  const paintCell = useCallback((r: number, c: number) => {
    setGrid((prev) => {
      if (prev[r][c] === effectiveColor) return prev;
      const next = prev.map((row) => [...row]);
      next[r][c] = effectiveColor;
      return next;
    });
  }, [effectiveColor]);

  const handlePointerDown = useCallback(
    (r: number, c: number) => {
      setIsDrawing(true);
      paintCell(r, c);
    },
    [paintCell],
  );

  const handlePointerEnter = useCallback(
    (r: number, c: number) => {
      if (isDrawing) paintCell(r, c);
    },
    [isDrawing, paintCell],
  );

  React.useEffect(() => {
    const onUp = () => setIsDrawing(false);
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  // ── actions ────────────────────────────────────────────────────────────

  const clearGrid = () => setGrid(newGrid());

  const randomize = () => setGrid((g) => randomizeGrid(g, 0.35));

  // ── canvas rendering ───────────────────────────────────────────────────

  const renderGridToCanvas = useCallback((canvas: HTMLCanvasElement, scale: number = 1) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = GRID * scale;
    canvas.height = GRID * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        ctx.fillStyle = grid[r][c] === 'black' ? '#000' : grid[r][c] === 'gray' ? '#999' : '#fff';
        ctx.fillRect(c * scale, r * scale, scale, scale);
      }
  }, [grid]);

  // ── print flow ─────────────────────────────────────────────────────────

  const printArt = async () => {
    const el = ticketRef.current;
    if (!el) return;
    setPrintStatus('loading');
    setPrintError('');

    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    try {
      await printTicket(el);
      setPrintStatus('success');
      setTimeout(() => setPrintStatus('idle'), 3000);
    } catch (err) {
      setPrintStatus('error');
      setPrintError(err instanceof Error ? err.message : String(err));
    }
  };

  // ── preview modal ──────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!previewOpen) {
      setPreviewUrl(null);
      return;
    }
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    renderGridToCanvas(canvas, 16);
    // Small delay to let canvas paint
    setTimeout(() => {
      setPreviewUrl(canvas.toDataURL('image/png'));
    }, 50);
  }, [previewOpen, grid, renderGridToCanvas]);

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FF90E8] flex flex-col font-mono p-4 md:p-6">
      {/* ── header ── */}
      <header className="max-w-3xl mx-auto w-full mb-8">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 bg-white border-4 border-black font-bold px-3 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-black leading-tight bg-[#E0FF4F] border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              PIXEL STUDIO
            </h1>
            <p className="text-black font-bold mt-3 text-base md:text-lg bg-white border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
              Draw tiny art. Print it small.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full flex flex-col md:flex-row gap-6 flex-1">
        {/* ── left: controls + grid ── */}
        <div className="flex flex-col gap-5 items-center md:items-start">
          {/* pixel grid */}
          <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] select-none">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${GRID}, 1fr)`,
                width: 240,
                height: 240,
                imageRendering: 'pixelated',
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const cellSize = rect.width / GRID;
                const c = Math.floor((e.clientX - rect.left) / cellSize);
                const r = Math.floor((e.clientY - rect.top) / cellSize);
                if (r >= 0 && r < GRID && c >= 0 && c < GRID) {
                  handlePointerEnter(r, c);
                }
              }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    onPointerDown={(e) => { e.preventDefault(); handlePointerDown(r, c); }}
                    onPointerEnter={() => handlePointerEnter(r, c)}
                    style={{
                      width: 15,
                      height: 15,
                      backgroundColor:
                        cell === 'black' ? '#000' : cell === 'gray' ? '#9ca3af' : '#fff',
                      border: '1px solid #ccc',
                      cursor: tool === 'eraser' ? 'cell' : 'crosshair',
                    }}
                  />
                )),
              )}
            </div>
          </div>

          {/* tool bar */}
          <div className="flex gap-3">
            <button
              onClick={clearGrid}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-4 border-black font-black uppercase tracking-tighter text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
            <button
              onClick={randomize}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e] border-4 border-black font-black uppercase tracking-tighter text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Dice5 className="w-4 h-4" /> Random
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#38bdf8] border-4 border-black font-black uppercase tracking-tighter text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>

          {/* color palette */}
          <div className="flex gap-3">
            {PALETTE.map((swatch) => (
              <button
                key={swatch.value}
                onClick={() => { setColor(swatch.value); setTool('pencil'); }}
                title={swatch.label}
                className={`w-11 h-11 border-4 flex items-center justify-center transition-all ${
                  tool === 'pencil' && color === swatch.value
                    ? 'border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-1'
                    : 'border-gray-300 hover:border-black'
                }`}
                style={{ backgroundColor: swatch.bg }}
              >
                {tool === 'pencil' && color === swatch.value && (
                  <Square className="w-5 h-5" style={{ color: swatch.ring }} />
                )}
              </button>
            ))}
            <button
              onClick={() => setTool(tool === 'eraser' ? 'pencil' : 'eraser')}
              className={`w-11 h-11 border-4 flex items-center justify-center transition-all ${
                tool === 'eraser'
                  ? 'border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-1'
                  : 'border-gray-300 hover:border-black bg-gray-100'
              }`}
              title="Eraser"
            >
              <Square className={`w-5 h-5 ${tool === 'eraser' ? 'text-black' : 'text-gray-500'}`} />
            </button>
          </div>
        </div>

        {/* ── right: print button ── */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <button
            onClick={printArt}
            disabled={printStatus === 'loading'}
            className={`w-full md:w-auto border-4 border-black font-black text-lg py-5 px-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest ${
              printStatus === 'error'
                ? 'bg-red-400'
                : printStatus === 'success'
                  ? 'bg-[#22c55e]'
                  : 'bg-black text-[#FFE135]'
            }`}
          >
            <Printer className="w-6 h-6" />
            {printStatus === 'loading'
              ? 'Printing…'
              : printStatus === 'success'
                ? 'Art Sent!'
                : printStatus === 'error'
                  ? 'Error — Try Again'
                  : 'Print My Art'}
          </button>

          {printStatus === 'error' && (
            <p className="text-xs font-bold bg-red-400 border-2 border-black px-3 py-1">
              {printError}
            </p>
          )}

          {/* size hint */}
          <div className="text-xs font-bold text-black/60 mt-4 text-center">
            16 × 16 pixels · pure black & white on paper
          </div>
        </div>
      </main>

      {/* ── hidden thermal-printer ticket ── */}
      <div ref={ticketRef} className="fixed top-0 left-[-9999px] pointer-events-none" aria-hidden="true">
        <div className="bg-white text-black font-mono w-[320px] p-5 box-border">
          {/* header */}
          <div className="text-center border-b-2 border-dashed border-black pb-3 mb-4">
            <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-1">◆ ◆ ◆</div>
            <div className="text-2xl font-black uppercase tracking-tight">PIXEL STUDIO</div>
            <div className="text-[10px] font-bold tracking-widest mt-1">ORIGINAL CREATION</div>
          </div>

          {/* pixel art */}
          <div className="flex justify-center my-4">
            <canvas
              ref={(el) => {
                if (el) renderGridToCanvas(el, 14);
              }}
              style={{ imageRendering: 'pixelated', border: '3px solid #000' }}
            />
          </div>

          {/* decorative divider */}
          <div className="text-center text-sm font-bold my-3 tracking-widest">
            — ◆ —
          </div>

          {/* footer */}
          <div className="border-t-2 border-dashed border-black pt-3 text-center">
            <div className="text-[10px] font-bold mb-1">
              {new Date().toLocaleString('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
            <div className="text-[11px] font-bold tracking-widest uppercase">
              ◈ Printed from The Exchange Terminal ◈
            </div>
          </div>
        </div>
      </div>

      {/* ── preview modal ── */}
      {previewOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white border-4 border-black p-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 bg-[#ff6b6b] border-4 border-black w-9 h-9 flex items-center justify-center font-black hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              ✕
            </button>
            <h3 className="text-xl font-black uppercase tracking-tight mb-4 text-center border-b-4 border-black pb-2">
              Pixel Preview
            </h3>
            <div className="bg-gray-100 border-4 border-black p-3 inline-block w-full flex justify-center">
              <canvas
                ref={previewCanvasRef}
                style={{ imageRendering: 'pixelated', maxWidth: '100%', aspectRatio: '1/1' }}
              />
            </div>
            <p className="text-xs font-bold text-center mt-3 text-gray-600">
              {previewUrl ? '16 × 16 · pixel art' : 'Rendering…'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
