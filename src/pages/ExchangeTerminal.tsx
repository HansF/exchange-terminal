import { Printer, Download, Receipt, Code, Sparkles, Skull, Terminal, ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';
import html2canvas from 'html2canvas';

type Theme = 'standard' | 'magic' | 'punk' | 'system';
type TicketType = 'both' | 'offer' | 'demand';

const THEMES = {
  standard: {
    id: 'standard',
    name: 'Standard',
    icon: Receipt,
    header: 'EXCHANGE',
    sub: '*** TICKET ***',
    wrapperClass: 'border-0',
    titleClass: 'border-b-[2px] border-black uppercase text-xl font-bold pb-2',
    subClass: 'text-xs font-bold mt-2',
    dividerClass: 'border-b border-black border-dashed pb-1 mb-2',
    textClass: 'text-sm font-medium',
    footerClass: 'border-t-[2px] border-black pt-4'
  },
  magic: {
    id: 'magic',
    name: 'Mystical',
    icon: Sparkles,
    header: '✧ THE ORACLE ✧',
    sub: 'READINGS & WISHES',
    wrapperClass: 'border-[4px] border-double border-black p-2 bg-white',
    titleClass: 'border-b-[1px] border-black uppercase text-xl font-bold pb-2',
    subClass: 'text-xs font-bold mt-2',
    dividerClass: 'border-b-[2px] border-black border-dotted pb-1 mb-2',
    textClass: 'text-sm italic font-bold',
    footerClass: 'border-t-[2px] border-dotted border-black pt-4'
  },
  punk: {
    id: 'punk',
    name: 'DIY Punk',
    icon: Skull,
    header: 'X/ MUTUAL AID /X',
    sub: 'NO COPS NO MASTERS',
    wrapperClass: 'border-0 bg-white',
    titleClass: 'border-y-[6px] py-1 border-black uppercase text-2xl font-black tracking-tighter',
    subClass: 'text-[10px] font-black mt-1 bg-black text-white py-1 block w-full',
    dividerClass: 'border-b-[4px] border-black pb-1 mb-2',
    textClass: 'text-base font-black uppercase leading-tight tracking-tight',
    footerClass: 'border-t-[8px] border-black pt-4'
  },
  system: {
    id: 'system',
    name: 'Terminal',
    icon: Terminal,
    header: '[ REC.TRANSFER ]',
    sub: 'OP_CODE: 0x9A',
    wrapperClass: 'border-[2px] border-black bg-white',
    titleClass: 'border-b-[1px] border-black uppercase text-lg font-bold pb-2',
    subClass: 'text-xs mt-2',
    dividerClass: 'border-b-[1px] border-black pb-1 mb-2',
    textClass: 'text-xs font-bold uppercase',
    footerClass: 'border-t-[1px] border-black pt-4'
  }
};

interface Props {
  onBack: () => void;
}

export default function ExchangeTerminal({ onBack }: Props) {
  const [name, setName] = useState('');
  const [offering, setOffering] = useState('');
  const [demand, setDemand] = useState('');
  const [ticketType, setTicketType] = useState<TicketType>('both');
  const [theme, setTheme] = useState<Theme>('standard');
  const [printStatus, setPrintStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [printError, setPrintError] = useState('');

  const activeTheme = THEMES[theme];

  const captureTicketCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const element = document.getElementById('ticket-container');
    if (!element) return null;
    const canvas = await html2canvas(element, { scale: 4, backgroundColor: '#FFFFFF', logging: false });
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const color = brightness > 128 ? 255 : 0;
        data[i] = color; data[i + 1] = color; data[i + 2] = color;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return canvas;
  };

  const handlePrint = async () => {
    setPrintStatus('loading');
    setPrintError('');
    try {
      const canvas = await captureTicketCanvas();
      if (!canvas) return;
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: canvas.toDataURL('image/png') }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Unknown error');
      setPrintStatus('success');
      setTimeout(() => setPrintStatus('idle'), 3000);
    } catch (err) {
      setPrintStatus('error');
      setPrintError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportHTML = () => {
    const el = document.getElementById('ticket-container');
    if (!el) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Printable Exchange Ticket</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body {
      background: #FFFFFF;
      display: flex;
      justify-content: center;
      padding: 40px;
      margin: 0;
      font-family: 'Space Mono', monospace;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 0; }
    }
  </style>
</head>
<body class="antialiased">
  ${el.outerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `ticket-${name.replace(/\s+/g, '-').toLowerCase() || 'export'}.html`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadImage = async () => {
    const canvas = await captureTicketCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `exchange-ticket-${name.replace(/\s+/g, '-').toLowerCase() || 'guest'}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      <header className="max-w-5xl mx-auto w-full mb-8 no-print">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 bg-white border-2 border-black font-bold px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-black tracking-tighter bg-white border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              THE EXCHANGE TERMINAL
            </h1>
            <p className="text-black font-bold mt-4 text-lg max-w-2xl bg-[#FF90E8] border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
              Generate printable black-and-white receipts for offerings & demands at your event.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full flex flex-col lg:flex-row gap-8 items-start flex-1">
        <div className="w-full lg:w-1/2 bg-white p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] no-print">

          <div className="mb-6 border-b-2 border-black pb-6">
            <h3 className="font-black uppercase mb-3 text-lg">1. Select Mode</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'both', label: 'Exchange (Both)' },
                { id: 'offer', label: 'Providing Only' },
                { id: 'demand', label: 'Seeking Only' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setTicketType(type.id as TicketType)}
                  className={`border-2 border-black font-bold py-2 px-2 text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                    ticketType === type.id ? 'bg-black text-white' : 'bg-[#E0FF4F] text-black hover:bg-yellow-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 border-b-2 border-black pb-6">
            <h3 className="font-black uppercase mb-3 text-lg">2. Visual Theme</h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.values(THEMES)).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as Theme)}
                    className={`border-2 border-black font-bold py-2 px-3 text-sm flex items-center gap-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                      theme === t.id ? 'bg-black text-white' : 'bg-[#FF90E8] text-black hover:bg-pink-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-black uppercase mb-3 text-lg">3. Enter Details</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-black uppercase mb-1">
                Name / Alias
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Who are you?"
                className="w-full px-4 py-2 border-2 border-black focus:ring-0 focus:outline-none focus:bg-yellow-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono"
                maxLength={40}
              />
            </div>

            {(ticketType === 'both' || ticketType === 'offer') && (
              <div>
                <label htmlFor="offering" className="block text-sm font-black uppercase mb-1">
                  Providing (Offer)
                </label>
                <textarea
                  id="offering"
                  value={offering}
                  onChange={(e) => setOffering(e.target.value)}
                  placeholder="What are you bringing to the table?"
                  className="w-full px-4 py-2 border-2 border-black focus:ring-0 focus:outline-none focus:bg-yellow-50 transition-colors resize-none h-28 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono"
                  maxLength={200}
                />
              </div>
            )}

            {(ticketType === 'both' || ticketType === 'demand') && (
              <div>
                <label htmlFor="demand" className="block text-sm font-black uppercase mb-1">
                  Seeking (Demand)
                </label>
                <textarea
                  id="demand"
                  value={demand}
                  onChange={(e) => setDemand(e.target.value)}
                  placeholder="What are you currently looking for?"
                  className="w-full px-4 py-2 border-2 border-black focus:ring-0 focus:outline-none focus:bg-yellow-50 transition-colors resize-none h-28 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono"
                  maxLength={200}
                />
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col items-center">

          <div className="no-print w-full grid grid-cols-3 gap-2 mb-6">
            <button
              onClick={exportHTML}
              className="bg-white border-2 border-black text-black font-bold py-3 px-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center gap-1 text-xs sm:text-sm"
              title="Gets a pure HTML DOM element that is easy to parse by scripts later."
            >
              <Code className="w-5 h-5" />
              <span>Get HTML</span>
            </button>
            <button
              onClick={downloadImage}
              className="bg-[#38bdf8] border-2 border-black text-black font-bold py-3 px-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center gap-1 text-xs sm:text-sm"
              title="Downloads a strict Black & White PNG file"
            >
              <Download className="w-5 h-5" />
              <span>Get PNG</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={printStatus === 'loading'}
              className={`border-2 border-black font-bold py-3 px-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center gap-1 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${printStatus === 'error' ? 'bg-red-400' : 'bg-[#22c55e]'}`}
              title={printStatus === 'error' ? printError : 'Print to thermal printer'}
            >
              <Printer className="w-5 h-5" />
              <span>
                {printStatus === 'loading' ? 'Printing…' :
                 printStatus === 'success' ? 'Sent!' :
                 printStatus === 'error'   ? 'Error' : 'Print'}
              </span>
            </button>
          </div>

          <div className="bg-gray-200 border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full flex justify-center no-print overflow-x-auto relative">
             <div className="absolute top-2 left-2 text-xs font-black uppercase text-gray-400">POS Simulator</div>

            <div
              id="ticket-container"
              data-type={ticketType}
              data-theme={theme}
              className={`bg-white text-black font-mono w-[300px] sm:w-[320px] p-4 box-border relative ${activeTheme.wrapperClass}`}
              style={{ fontSmoothing: 'none', WebkitFontSmoothing: 'none' } as React.CSSProperties}
            >
              <div className="text-center mb-6" data-id="ticket-header">
                <h2 className={activeTheme.titleClass}>
                  {activeTheme.header}
                </h2>
                <div className={activeTheme.subClass}>
                  {activeTheme.sub}
                </div>
              </div>

              <div className="mb-6">
                <div className={activeTheme.dividerClass}>
                  <div className="text-xs uppercase font-bold">Name / Alias</div>
                </div>
                <div className="text-lg font-bold uppercase break-words leading-tight" data-id="ticket-name">
                  {name.trim() || 'ANONYMOUS'}
                </div>
              </div>

              {(ticketType === 'both' || ticketType === 'offer') && (
                <div className="mb-6">
                  <div className={activeTheme.dividerClass}>
                    <div className="text-xs uppercase font-bold flex justify-between">
                      <span>Providing</span>
                      <span>(OFFER)</span>
                    </div>
                  </div>
                  <div className={`break-words whitespace-pre-wrap leading-snug ${activeTheme.textClass}`} data-id="ticket-offer">
                    {offering.trim() || 'NO OFFER PROVIDED'}
                  </div>
                </div>
              )}

              {(ticketType === 'both' || ticketType === 'demand') && (
                <div className="mb-8">
                  <div className={activeTheme.dividerClass}>
                    <div className="text-xs uppercase font-bold flex justify-between">
                      <span>Seeking</span>
                      <span>(DEMAND)</span>
                    </div>
                  </div>
                  <div className={`break-words whitespace-pre-wrap leading-snug ${activeTheme.textClass}`} data-id="ticket-demand">
                    {demand.trim() || 'NO DEMAND PROVIDED'}
                  </div>
                </div>
              )}

              <div className={`text-center ${activeTheme.footerClass}`}>
                <div className="text-[11px] mb-2 font-bold truncate">
                  {new Date().toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-[12px] uppercase font-black tracking-widest bg-black text-white px-2 py-1 inline-block">
                  {ticketType === 'both' ? 'MUTUAL AID' : (ticketType === 'offer' ? 'GIFT' : 'REQUEST')}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
