
import React, { useState, useEffect } from 'react';

interface FrameStabilizerProps {
  frames: string[];
  onUpdate: (updatedFrames: string[]) => void;
}

const FrameStabilizer: React.FC<FrameStabilizerProps> = ({ frames, onUpdate }) => {
  const [offsets, setOffsets] = useState<{x: number, y: number}[]>(frames.map(() => ({x: 0, y: 0})));
  const [activeFrame, setActiveFrame] = useState(1); // Começar no 2º frame (index 1) para alinhar com o 1º
  const [showOnion, setShowOnion] = useState(true);

  const nudge = (dx: number, dy: number) => {
    const newOffsets = [...offsets];
    newOffsets[activeFrame] = {
      x: newOffsets[activeFrame].x + dx,
      y: newOffsets[activeFrame].y + dy
    };
    setOffsets(newOffsets);
  };

  const applyStabilization = async () => {
    const stabilized = await Promise.all(frames.map(async (frameUrl, i) => {
      if (offsets[i].x === 0 && offsets[i].y === 0) return frameUrl;
      
      return new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, offsets[i].x, offsets[i].y);
            resolve(canvas.toDataURL());
          }
        };
        img.src = frameUrl;
      });
    }));
    onUpdate(stabilized);
    alert("Alinhamento aplicado com sucesso!");
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-black text-yellow-400 uppercase tracking-widest">Estabilizador de Precisão</h3>
          <p className="text-[10px] text-slate-500 uppercase mt-0.5">Alinha os frames individualmente</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowOnion(!showOnion)}
             className={`px-3 py-1 rounded-full text-[9px] font-bold border transition-all ${showOnion ? 'bg-yellow-400 text-slate-950 border-yellow-400' : 'text-slate-500 border-slate-700 hover:text-slate-300'}`}
           >
             ONION SKIN: {showOnion ? 'ON' : 'OFF'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Preview Area */}
        <div className="relative aspect-square bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-800 ring-4 ring-slate-900/50">
          {/* Frame 1 (Static Reference) */}
          {showOnion && (
            <img 
              src={frames[0]} 
              className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale" 
              alt="Reference" 
            />
          )}
          
          {/* Active Frame with Offset */}
          <div 
            className="absolute inset-0 w-full h-full transition-none"
            style={{ transform: `translate(${offsets[activeFrame].x}px, ${offsets[activeFrame].y}px)` }}
          >
            <img src={frames[activeFrame]} className="w-full h-full object-cover" alt="Active" />
          </div>

          <div className="absolute top-3 left-3 bg-black/80 px-2 py-1 rounded text-[9px] font-mono text-white border border-white/10">
            FRAME {activeFrame + 1}
          </div>
          
          {/* Crosshair Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
            <div className="w-full h-[1px] bg-yellow-400"></div>
            <div className="h-full w-[1px] bg-yellow-400 absolute"></div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Seleccionar Frame (2-9)</label>
            <div className="grid grid-cols-4 gap-2">
              {frames.slice(1).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveFrame(i + 1)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${activeFrame === i + 1 ? 'bg-yellow-400 text-slate-950 scale-105 shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  #{i + 2}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center gap-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Ajuste de Posição (Nudge)</p>
            <div className="grid grid-cols-3 gap-2">
              <div></div>
              <button onClick={() => nudge(0, -1)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-yellow-400 border border-slate-700">▲</button>
              <div></div>
              <button onClick={() => nudge(-1, 0)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-yellow-400 border border-slate-700">◀</button>
              <div className="flex items-center justify-center font-mono text-[10px] text-slate-500">{offsets[activeFrame].x},{offsets[activeFrame].y}</div>
              <button onClick={() => nudge(1, 0)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-yellow-400 border border-slate-700">▶</button>
              <div></div>
              <button onClick={() => nudge(0, 1)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-yellow-400 border border-slate-700">▼</button>
              <div></div>
            </div>
            <p className="text-[9px] text-slate-600 text-center italic">Usa as setas para alinhar a cabeça do frame activo com o fantasma do frame 1.</p>
          </div>

          <button
            onClick={applyStabilization}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            APLICAR CORREÇÕES AO ASSET
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrameStabilizer;
