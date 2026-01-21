
import React, { useState } from 'react';

interface DiagnosticToolProps {
  originalImage: string;
  frames: string[];
  onClose: () => void;
}

const DiagnosticTool: React.FC<DiagnosticToolProps> = ({ originalImage, frames, onClose }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'stack'>('grid');
  const [opacity, setOpacity] = useState(0.3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-5xl h-full flex flex-col rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h3 className="text-xl font-black text-yellow-400 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              DIAGNÓSTICO DE ALINHAMENTO
            </h3>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Verifica se o problema é a IA ou o Corte</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${viewMode === 'grid' ? 'bg-yellow-400 text-slate-950' : 'text-slate-500'}`}
            >
              Grelha de Corte
            </button>
            <button 
              onClick={() => setViewMode('stack')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${viewMode === 'stack' ? 'bg-yellow-400 text-slate-950' : 'text-slate-500'}`}
            >
              Sobreposição (Stack)
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          {viewMode === 'grid' ? (
            <div className="relative border-4 border-slate-800 shadow-2xl max-w-full max-h-full aspect-square">
              <img src={originalImage} className="max-w-full max-h-[70vh] block" alt="Original Grid" />
              {/* Overlay Grid Lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-0 w-full h-[1px] bg-red-500/50 shadow-[0_0_5px_red]"></div>
                <div className="absolute top-2/3 left-0 w-full h-[1px] bg-red-500/50 shadow-[0_0_5px_red]"></div>
                <div className="absolute left-1/3 top-0 w-[1px] h-full bg-red-500/50 shadow-[0_0_5px_red]"></div>
                <div className="absolute left-2/3 top-0 w-[1px] h-full bg-red-500/50 shadow-[0_0_5px_red]"></div>
              </div>
              <div className="absolute -top-6 left-0 text-[10px] font-bold text-red-400 uppercase">Linhas de Corte Exactas (3x3)</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 w-full max-w-xl">
              <div className="relative aspect-square w-full rounded-3xl overflow-hidden border-4 border-slate-800 bg-slate-950 shadow-2xl">
                {frames.map((frame, i) => (
                  <img 
                    key={i} 
                    src={frame} 
                    style={{ opacity: i === 0 ? 1 : opacity }}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" 
                    alt="" 
                  />
                ))}
              </div>
              
              <div className="w-full space-y-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opacidade dos Fantasmas (Frames 2-9)</span>
                  <span className="text-yellow-400 font-mono text-sm">{Math.round(opacity * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.05" max="0.5" step="0.01" value={opacity} 
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <p className="text-[11px] text-slate-400 leading-relaxed italic">
                    💡 <span className="text-white font-bold">Como ler:</span> Se a cabeça parecer nítida, o alinhamento da IA está bom. Se vires vários narizes ou olhos (fantasmas), a IA mudou o personagem de lugar entre os frames.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all text-sm"
          >
            FECHAR DIAGNÓSTICO
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticTool;
