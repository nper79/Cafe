
import React from 'react';
import { GeneratedImage } from '../types';

interface ImageDisplayProps {
  images: GeneratedImage[];
  isGenerating: boolean;
  loadingMessage: string;
  onSlice: (image: GeneratedImage) => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ images, isGenerating, loadingMessage, onSlice }) => {
  if (images.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-900 rounded-3xl text-slate-600">
        <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
        <p className="text-sm font-medium">Your canvas is empty.</p>
        <p className="text-xs">Enter a prompt to see some nano magic!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
      {isGenerating && (
        <div className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center p-8 animate-pulse">
          <div className="w-16 h-16 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin mb-4"></div>
          <p className="text-yellow-400 text-sm font-medium mb-1">Creating...</p>
          <p className="text-slate-500 text-[10px] italic">{loadingMessage}</p>
        </div>
      )}
      
      {images.map((image) => (
        <div 
          key={image.id} 
          className={`group relative rounded-2xl overflow-hidden bg-slate-900 border shadow-2xl transition-all duration-300 ${
            image.tag === 'idle' ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 
            image.tag === 'talking' ? 'border-yellow-400/50 ring-1 ring-yellow-400/20' :
            image.isSlice ? 'border-blue-500/30 ring-1 ring-blue-500/10' : 'border-slate-800 hover:shadow-yellow-500/10'
          }`}
        >
          <img 
            src={image.url} 
            alt={image.prompt} 
            className="w-full h-auto object-cover aspect-square bg-slate-800 group-hover:scale-105 transition-transform duration-500"
          />
          
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
            {image.isSlice && (
              <span className="bg-blue-600/90 text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded shadow-lg backdrop-blur-sm w-fit">
                {image.model === 'video-frame' ? 'VIDEO FRAME' : 'Slice Result'}
              </span>
            )}
            {image.tag && (
              <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded shadow-lg backdrop-blur-sm w-fit ${
                image.tag === 'idle' ? 'bg-emerald-500 text-white' : 'bg-yellow-400 text-slate-950'
              }`}>
                {image.tag}
              </span>
            )}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-slate-950/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
            <div className="space-y-3">
              <p className="text-[11px] text-white line-clamp-2 font-medium bg-black/40 p-1 rounded backdrop-blur-[2px]">"{image.prompt}"</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  {image.model === 'video-frame' ? 'V-FRAME' : image.model === 'manual-slice' ? 'SLICED' : image.model === 'gemini-2.5-flash-image' ? '2.5 FLASH' : '3.0 PRO'}
                </span>
                <div className="flex gap-1.5">
                  {!image.isSlice && (
                    <button 
                      onClick={() => onSlice(image)}
                      title="Slice Grid (3x3)"
                      className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-400 transition-all active:scale-90"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    </button>
                  )}
                  <a 
                    href={image.url} 
                    download={`nano-banana-${image.id}.png`}
                    className="bg-yellow-400 text-slate-900 p-2 rounded-lg hover:bg-white transition-all active:scale-90"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageDisplay;
