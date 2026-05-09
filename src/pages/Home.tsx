import { Receipt, Sparkles, ArrowRight, Camera, Timer, Image } from 'lucide-react';
import type { ComponentType } from 'react';
import type { ToolPage } from '../App';

interface Props {
  onNavigate: (page: ToolPage) => void;
}

const APPS: Array<{
  page: ToolPage;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    page: 'exchange',
    title: 'Exchange Tickets',
    description: 'Generate printable receipts for offerings and demands. Prints to thermal printer.',
    icon: Receipt,
    accent: 'bg-[#E0FF4F]',
  },
  {
    page: 'fortune',
    title: 'The Oracle',
    description: 'Draw a fortune from the camp-specific prophecies. Prints directly.',
    icon: Sparkles,
    accent: 'bg-[#FF90E8]',
  },
  {
    page: 'stencilcam',
    title: 'StencilCam',
    description: 'AI caricatures from your camera. Pure 1-bit art, thermal-ready.',
    icon: Camera,
    accent: 'bg-[#E0FF4F]',
  },
  {
    page: 'todo',
    title: 'Focus Timer',
    description: 'Track focus sessions and print a running paper log for the day.',
    icon: Timer,
    accent: 'bg-white',
  },
  {
    page: 'threshold',
    title: 'Threshold Stencil',
    description: 'Upload an image, tune the threshold, then export or print a 1-bit stencil.',
    icon: Image,
    accent: 'bg-[#38bdf8]',
  },
];

export default function Home({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-[#FFE135] flex flex-col font-mono p-4 md:p-8">
      <header className="max-w-6xl mx-auto w-full mb-12">
        <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter bg-white border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-1">
          THE EXCHANGE TERMINAL
        </h1>
        <p className="text-black font-bold mt-4 text-lg bg-[#FF90E8] border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
          Tools for the event floor.
        </p>
      </header>

      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
        {APPS.map((app) => {
          const Icon = app.icon;
          return (
            <button
              key={app.page}
              onClick={() => onNavigate(app.page)}
              className={`group ${app.accent} border-4 border-black p-5 min-h-[250px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-left flex flex-col gap-4`}
            >
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-black p-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] shrink-0">
                  <Icon className="w-7 h-7 text-black" />
                </div>
                <h2 className="text-lg font-black uppercase leading-tight break-words">{app.title}</h2>
              </div>
              <p className="text-sm font-medium text-gray-700 leading-relaxed">
                {app.description}
              </p>
              <div className="flex items-center gap-2 font-black uppercase text-sm mt-auto pt-4 border-t-2 border-black group-hover:gap-3 transition-all">
                Open <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
