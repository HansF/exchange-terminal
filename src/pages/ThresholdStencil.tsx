import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Image, Upload } from 'lucide-react';
import { ThresholdFilter } from '../components/ThresholdFilter';

interface Props {
  onBack: () => void;
}

export default function ThresholdStencil({ onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setImageSrc(URL.createObjectURL(file));
    event.target.value = '';
  };

  const resetImage = () => setImageSrc(null);

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
            <h1 className="text-3xl md:text-5xl font-black text-black leading-tight bg-[#38bdf8] border-4 border-black inline-block px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              THRESHOLD STENCIL
            </h1>
            <p className="text-black font-bold mt-4 text-lg bg-white border-2 border-black p-2 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
              Image to pure black-and-white receipt art.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full flex-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />

        {imageSrc ? (
          <ThresholdFilter imageSrc={imageSrc} onRedo={resetImage} />
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-[420px] bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center gap-6 text-center"
          >
            <div className="bg-[#38bdf8] border-4 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Image className="w-14 h-14" />
            </div>
            <div>
              <div className="text-3xl font-black uppercase leading-tight">Choose Image</div>
              <div className="mt-2 text-sm font-bold uppercase text-black/50 flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                PNG, JPEG, or WebP
              </div>
            </div>
          </button>
        )}
      </main>
    </div>
  );
}
