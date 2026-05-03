import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Circle } from 'lucide-react';

interface CameraBridgeProps {
  onCapture: (base64: string) => void;
  isProcessing: boolean;
}

export const CameraBridge: React.FC<CameraBridgeProps> = ({ onCapture, isProcessing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera Access Error:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return stopStream;
  }, [startCamera, stopStream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    canvas.width = 1024;
    canvas.height = 1024;
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, startX, startY, size, size, 0, 0, 1024, 1024);
      onCapture(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    }
  };

  return (
    <div className="relative w-full aspect-square bg-black border-4 border-black overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-red-600">
          <RefreshCw className="w-12 h-12 mb-4" />
          <p className="font-bold uppercase tracking-tighter text-xl">{error}</p>
          <button
            onClick={startCamera}
            className="mt-4 px-6 py-2 bg-white text-black font-bold border-2 border-black active:translate-y-1"
          >
            RETRY
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <canvas ref={canvasRef} className="hidden" />

          {!isProcessing && isActive && (
            <div className="absolute inset-0 flex items-end justify-center pb-8">
              <button
                onClick={capturePhoto}
                className="group relative p-1 bg-white border-4 border-black rounded-full active:scale-95 transition-transform"
              >
                <div className="p-4 bg-white border-2 border-black rounded-full group-hover:bg-gray-100">
                  <Circle className="w-8 h-8 fill-black" />
                </div>
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Camera className="w-8 h-8 animate-pulse" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
