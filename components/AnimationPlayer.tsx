
import React, { useState, useEffect, useRef } from 'react';

interface AnimationPlayerProps {
  frames: string[];
  fps: number;
}

const AnimationPlayer: React.FC<AnimationPlayerProps> = ({ frames, fps }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      const interval = 1000 / fps;
      
      const nextFrame = () => {
        setCurrentFrame((prev) => (prev + 1) % frames.length);
        timeoutRef.current = window.setTimeout(nextFrame, interval);
      };

      timeoutRef.current = window.setTimeout(nextFrame, interval);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, frames, fps]);

  if (frames.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-sm rounded-2xl overflow-hidden border-4 border-yellow-400/30 shadow-[0_0_30px_rgba(250,204,21,0.2)] bg-slate-800">
        <img 
          src={frames[currentFrame]} 
          alt={`Frame ${currentFrame}`} 
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white border border-white/10">
          FRAME {currentFrame + 1}/{frames.length}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="bg-slate-800 hover:bg-slate-700 text-yellow-400 p-3 rounded-full border border-slate-700 transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default AnimationPlayer;
