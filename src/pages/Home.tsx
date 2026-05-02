import { Receipt, Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  onNavigate: (page: 'exchange' | 'fortune') => void;
}

export default function Home({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      <header className="max-w-4xl mx-auto w-full mb-12">
        <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter bg-white border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-1">
          THE EXCHANGE TERMINAL
        </h1>
        <p className="text-black font-bold mt-4 text-lg bg-[#FF90E8] border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
          Tools for the event floor.
        </p>
      </header>

      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => onNavigate('exchange')}
          className="group bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-left flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="bg-[#E0FF4F] border-2 border-black p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <Receipt className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Exchange Tickets</h2>
          </div>
          <p className="text-sm font-medium text-gray-700 leading-relaxed">
            Generate printable black-and-white receipts for offerings & demands. Print directly to the thermal printer.
          </p>
          <div className="flex items-center gap-2 font-black uppercase text-sm mt-auto pt-4 border-t-2 border-black group-hover:gap-3 transition-all">
            Open <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        <button
          onClick={() => onNavigate('fortune')}
          className="group bg-[#FF90E8] border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-left flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white border-2 border-black p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">The Oracle</h2>
          </div>
          <p className="text-sm font-medium text-gray-700 leading-relaxed">
            Draw a fortune. 131 camp-specific prophecies awaiting your curiosity. Heed or ignore at your own peril.
          </p>
          <div className="flex items-center gap-2 font-black uppercase text-sm mt-auto pt-4 border-t-2 border-black group-hover:gap-3 transition-all">
            Open <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
