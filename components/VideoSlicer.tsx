
import React, { useState, useRef, useEffect } from 'react';
import { extractFramesFromVideo } from '../utils/videoUtils';
import { curateFrames } from '../services/geminiService';
import { VideoState } from '../types';

// --- CUSTOM HOOK FOR LOGIC ---
export const useVideoSlicer = () => {
  const [states, setStates] = useState<VideoState[]>([
    {
      id: 'default',
      name: 'Base (Neutro)',
      videoFile: null,
      videoPreview: null,
      frames: [],
      actionIntent: '',
      isProcessing: false,
      isCurating: false,
      progress: 0
    }
  ]);
  const [activeStateId, setActiveStateId] = useState<string>('default');
  const [previewMode, setPreviewMode] = useState<'none' | 'idle' | 'talking' | 'special'>('none');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [extractionDensity, setExtractionDensity] = useState(60); 
  
  const activeState = states.find(s => s.id === activeStateId) || states[0];
  
  // Derived state
  const activePreviewFrames = activeState.frames.filter(f => f.tag === previewMode);
  const safePreviewIndex = (previewIndex >= 0 && previewIndex < activePreviewFrames.length) ? previewIndex : 0;

  const handleSetPreviewMode = (mode: 'none' | 'idle' | 'talking' | 'special') => {
    setPreviewMode(mode);
    setPreviewIndex(0);
  };

  // Animation Loop
  useEffect(() => {
    let interval: any;
    if (previewMode !== 'none' && activeState.frames.length > 0) {
      const currentActiveFrames = activeState.frames.filter(f => f.tag === previewMode);
      if (currentActiveFrames.length > 0) {
        interval = setInterval(() => {
          setPreviewIndex(prev => {
             const next = prev + 1;
             return next >= currentActiveFrames.length ? 0 : next;
          });
        }, 120); 
      } else {
        // Fallback logic
        const hasIdle = activeState.frames.some(f => f.tag === 'idle');
        const hasSpecial = activeState.frames.some(f => f.tag === 'special');
        const hasTalking = activeState.frames.some(f => f.tag === 'talking');
        if (previewMode === 'talking' && !hasTalking && hasSpecial) handleSetPreviewMode('special');
        else if (previewMode === 'special' && !hasSpecial && hasIdle) handleSetPreviewMode('idle');
      }
    }
    return () => clearInterval(interval);
  }, [previewMode, activeState.frames]);

  const updateActiveState = (updates: Partial<VideoState>) => {
    setStates(prev => prev.map(s => s.id === activeStateId ? { ...s, ...updates } : s));
  };

  // UPDATED: Now inherits frames/video from the current active state to allow easy multi-segment creation
  const handleAddState = () => {
    const newId = Date.now().toString();
    
    // Check if current state has data to clone
    const sourceState = activeState;
    const hasData = sourceState.frames.length > 0;

    const newState: VideoState = {
      id: newId,
      name: `Nova Ação ${states.length + 1}`,
      // Clone video data if available
      videoFile: hasData ? sourceState.videoFile : null,
      videoPreview: hasData ? sourceState.videoPreview : null,
      // Clone frames but RESET tags (so user can select new segment)
      frames: hasData ? sourceState.frames.map(f => ({ url: f.url })) : [], 
      actionIntent: '',
      isProcessing: false,
      isCurating: false,
      progress: 0
    };

    setStates([...states, newState]);
    setActiveStateId(newId);
    handleSetPreviewMode('none');
  };

  const handleRemoveState = (id: string) => {
    if (states.length <= 1) return;
    const newStates = states.filter(s => s.id !== id);
    setStates(newStates);
    if (activeStateId === id) setActiveStateId(newStates[0].id);
  };

  // NEW: Import JSON Pack Logic
  const handleImportPack = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let newStates: VideoState[] = [];

        // Handle "Action Pack" Format (Array of actions)
        if (json.actions && Array.isArray(json.actions)) {
           newStates = json.actions.map((action: any, idx: number) => ({
             id: `imported-${Date.now()}-${idx}`,
             name: action.name || `Imported ${idx}`,
             videoFile: null, // Imported states don't have the source video
             videoPreview: null,
             // Mark imported frames as 'special' so they appear selected
             frames: action.frames.map((url: string) => ({ url, tag: 'special' })),
             actionIntent: '',
             isProcessing: false,
             isCurating: false,
             progress: 0
           }));
        } 
        // Handle "Legacy/Single" Format
        else if (json.frames && Array.isArray(json.frames)) {
           newStates = [{
             id: `imported-${Date.now()}`,
             name: json.name || "Imported Action",
             videoFile: null,
             videoPreview: null,
             frames: json.frames.map((url: string) => ({ url, tag: 'special' })),
             actionIntent: '',
             isProcessing: false,
             isCurating: false,
             progress: 0
           }];
        }

        if (newStates.length > 0) {
           // If the current state is empty/default, replace it. Otherwise append.
           if (states.length === 1 && states[0].frames.length === 0 && !states[0].videoFile) {
             setStates(newStates);
             setActiveStateId(newStates[0].id);
           } else {
             setStates(prev => [...prev, ...newStates]);
             setActiveStateId(newStates[0].id); // Switch to first imported
           }
        } else {
          alert("O ficheiro não contém ações válidas.");
        }

      } catch (err) {
        console.error(err);
        alert("Erro ao ler o ficheiro JSON.");
      }
      
      // Reset input
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!activeState.videoFile) return;
    updateActiveState({ isProcessing: true });
    try {
      const urls = await extractFramesFromVideo(activeState.videoFile, extractionDensity, (p) => {
        setStates(prev => prev.map(s => s.id === activeStateId ? { ...s, progress: p } : s));
      });
      updateActiveState({ frames: urls.map(url => ({ url })) });
    } catch (err) {
      alert("Erro ao processar vídeo.");
    } finally {
      updateActiveState({ isProcessing: false });
    }
  };

  const handleSmartCurate = async () => {
    if (activeState.frames.length === 0) return;
    updateActiveState({ isCurating: true });
    handleSetPreviewMode('none');
    try {
      const framesToAnalyze = activeState.frames.map((f, i) => ({ url: f.url, index: i }));
      const intent = activeState.actionIntent.trim() || "movement or talking";
      
      const suggestions = await curateFrames(framesToAnalyze, intent);
      
      const newFrames = activeState.frames.map(f => ({ ...f, tag: undefined }));
      let foundTalking = false;
      let foundSpecial = false;

      suggestions.forEach(s => {
        if (newFrames[s.index]) {
          newFrames[s.index].tag = s.tag as any;
          if (s.tag === 'talking') foundTalking = true;
          if (s.tag === 'special') foundSpecial = true;
        }
      });

      updateActiveState({ frames: newFrames });
      
      if (foundSpecial) handleSetPreviewMode('special');
      else if (foundTalking) handleSetPreviewMode('talking');
      else handleSetPreviewMode('idle');

    } catch (err) {
      console.error(err);
      alert("IA falhou na curadoria.");
    } finally {
      updateActiveState({ isCurating: false });
    }
  };

  const toggleTag = (index: number) => {
    const newFrames = activeState.frames.map((f, i) => {
      if (i !== index) return f;
      const isSelected = !!f.tag;
      return { ...f, tag: isSelected ? undefined : 'special' };
    });
    updateActiveState({ frames: newFrames });
  };

  // NEW: Exports ALL states in one JSON
  const handleExportAll = () => {
    const pack = {
      id: Date.now().toString(),
      name: "Character Action Pack",
      timestamp: Date.now(),
      // Export actions: Name -> List of selected frame URLs
      actions: states.map(s => ({
        name: s.name,
        frames: s.frames.filter(f => !!f.tag).map(f => f.url)
      })).filter(a => a.frames.length > 0)
    };

    if (pack.actions.length === 0) {
      alert("Nenhuma ação definida. Seleciona frames em pelo menos um segmento.");
      return;
    }

    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character_actions_pack.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const state = activeState;
    const selected = state.frames.filter(f => !!f.tag).map(f => f.url);

    // Legacy format export (single action)
    const assetData = {
      id: state.id,
      name: state.name,
      timestamp: Date.now(),
      frames: selected
    };

    const blob = new Blob([JSON.stringify(assetData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const countTags = (tag: string) => activeState.frames.filter(f => f.tag === tag).length;

  return {
    states,
    activeState,
    activeStateId,
    setActiveStateId,
    handleAddState,
    handleRemoveState,
    updateActiveState,
    handleProcess,
    handleSmartCurate,
    toggleTag,
    handleExportJSON,
    handleExportAll,
    handleImportPack,
    countTags,
    previewMode,
    activePreviewFrames,
    safePreviewIndex,
    handleSetPreviewMode,
    showFullscreen,
    setShowFullscreen,
    extractionDensity,
    setExtractionDensity
  };
};

// --- COMPONENT: SIDEBAR (Rendered in Left Bar) ---
export const VideoSlicerSidebar: React.FC<any> = (props) => {
  const { states, activeStateId, setActiveStateId, handleAddState, handleRemoveState, handleExportAll, handleImportPack, activeState } = props;
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // Count total actions that have at least 1 frame selected
  const readyActions = states.filter((s: any) => s.frames.some((f: any) => !!f.tag)).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
       <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Segmentos</h3>
          <div className="flex gap-2">
            <button 
                onClick={() => importInputRef.current?.click()}
                className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                title="Importar Pack JSON Existente"
              >
                <input type="file" ref={importInputRef} onChange={handleImportPack} accept=".json" className="hidden" />
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
            <button 
              onClick={handleAddState}
              className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
              title="Criar Novo Segmento (Clonar)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
          {states.map((state: VideoState) => {
            const selectedCount = state.frames.filter(f => !!f.tag).length;
            const isImported = !state.videoFile && state.frames.length > 0;
            
            return (
              <div 
                key={state.id}
                onClick={() => setActiveStateId(state.id)}
                className={`group flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  activeStateId === state.id 
                  ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/20 shadow-lg' 
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex flex-col overflow-hidden">
                    <span className={`text-[11px] font-bold truncate mb-1 flex items-center gap-2 ${activeStateId === state.id ? 'text-blue-400' : 'text-slate-200'}`}>
                      {state.name}
                      {isImported && (
                        <span className="text-[8px] bg-slate-800 px-1 py-0.5 rounded text-slate-500 border border-slate-700">IMP</span>
                      )}
                    </span>
                    <span className={`text-[9px] uppercase font-black tracking-wider ${selectedCount > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                      {selectedCount > 0 ? `${selectedCount} FRAMES` : 'VAZIO'}
                    </span>
                </div>
                {states.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveState(state.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {readyActions > 0 && (
          <div className="pt-4 border-t border-slate-800">
            <button 
              onClick={handleExportAll}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 flex flex-col items-center gap-1"
            >
              <span>BAIXAR PACK COMPLETO</span>
              <span className="opacity-70 font-normal">({readyActions} Ações Definidas)</span>
            </button>
          </div>
        )}
    </div>
  );
};

// --- COMPONENT: WORKSPACE (Rendered in Main Area) ---
export const VideoSlicerWorkspace: React.FC<any> = (props) => {
  const { 
    activeState, updateActiveState, handleProcess, handleSmartCurate, 
    toggleTag, activePreviewFrames, safePreviewIndex, handleSetPreviewMode, 
    previewMode, showFullscreen, setShowFullscreen, extractionDensity, setExtractionDensity,
    handleAddState 
  } = props;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalSelected = activeState.frames.filter((f: any) => !!f.tag).length;
  // Check if this is an imported state (has frames but no video file)
  const isImportedState = !activeState.videoFile && activeState.frames.length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateActiveState({
        videoFile: file,
        videoPreview: URL.createObjectURL(file),
        progress: 0,
        frames: []
      });
      handleSetPreviewMode('none');
    }
  };

  return (
    <>
      <div className="bg-slate-900/50 p-6 md:p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6 h-full flex flex-col">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 shrink-0">
          <div className="space-y-1 w-full md:w-auto flex-1">
             <div className="flex items-center gap-2 mb-2">
               <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">Segmento Atual</span>
               {isImportedState && <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Importado (Apenas Leitura)</span>}
             </div>
             
             {/* RENAMING INPUT */}
             <div className="relative group">
                <input 
                  type="text" 
                  value={activeState.name}
                  onChange={(e) => updateActiveState({ name: e.target.value })}
                  className="bg-transparent border-b-2 border-slate-800 focus:border-blue-500 text-2xl font-black text-white focus:ring-0 p-0 py-1 w-full placeholder-slate-700 transition-colors"
                  placeholder="Nome da Ação (ex: Piscar)"
                />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
             </div>
             <p className="text-[10px] text-slate-500 mt-2 font-medium">Dica: Este nome aparecerá no Speech Lab.</p>
          </div>
          
          <div className="flex items-center gap-4">
             {totalSelected > 0 && (
                <button 
                  onClick={handleAddState}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-white transition-all shadow-lg active:scale-95"
                >
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Confirmar &amp; Nova Ação</span>
                </button>
             )}

             <div className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 flex flex-col items-center min-w-[80px]">
                <span className="text-[8px] text-slate-600 font-black uppercase">FRAMES</span>
                <span className={`text-sm font-bold ${totalSelected > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{totalSelected}</span>
             </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          {(!activeState.videoFile && activeState.frames.length === 0) ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="h-full min-h-[400px] border-4 border-dashed border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
              <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-2xl border border-slate-800">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <p className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Carregar Vídeo Mestre</p>
              <p className="text-xs text-slate-500 mt-2 font-black uppercase tracking-[0.2em]">Extrai múltiplas ações de um só vídeo</p>
            </div>
          ) : (activeState.videoFile && activeState.frames.length === 0) ? (
            <div className="max-w-3xl mx-auto space-y-8 py-8">
              <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-black">
                <video src={activeState.videoPreview!} className="w-full h-full" controls />
              </div>
              
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6">
                 <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="text-sm font-black uppercase text-white">Densidade de Extração</span>
                      <p className="text-xs text-slate-500">Ajusta quantos frames queres analisar.</p>
                    </div>
                    <span className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-xs font-black">{extractionDensity} FRAMES</span>
                 </div>
                 <input 
                   type="range" min="20" max="120" step="5"
                   value={extractionDensity} 
                   onChange={(e) => setExtractionDensity(parseInt(e.target.value))}
                   className="w-full h-3 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
                 <div className="flex justify-between text-[10px] text-slate-600 font-bold uppercase px-1">
                   <span>Rápido (20)</span>
                   <span>Detalhado (60)</span>
                   <span>Super Slow (120)</span>
                 </div>
              </div>

              <button
                onClick={handleProcess}
                disabled={activeState.isProcessing}
                className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-base shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3"
              >
                {activeState.isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>A FATIAR VÍDEO ({activeState.progress}%)...</span>
                  </>
                ) : "EXTRAIR FRAMES AGORA"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 h-full">
              {/* Left Side: Large Thumbnails */}
              <div className="xl:col-span-3 space-y-6 flex flex-col h-full">
                {!isImportedState && (
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-inner shrink-0">
                     <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Sugestão Automática (Opcional)</label>
                          <input 
                            type="text" 
                            value={activeState.actionIntent}
                            onChange={(e) => updateActiveState({ actionIntent: e.target.value })}
                            placeholder="Ex: blinking, eyes closed..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500/50"
                          />
                        </div>
                        <button 
                          onClick={handleSmartCurate}
                          disabled={activeState.isCurating}
                          className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${activeState.isCurating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                        >
                          {activeState.isCurating ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : "AUTO-SELEÇÃO IA"}
                        </button>
                     </div>
                  </div>
                )}

                {/* BIG THUMBNAILS GRID */}
                <div className="grid grid-cols-2 lg:grid-cols-2 gap-6 overflow-y-auto p-4 bg-slate-950 rounded-2xl border border-slate-800 flex-1 min-h-0">
                  {activeState.frames.map((frame: any, idx: number) => {
                    const isSelected = !!frame.tag;
                    return (
                      <div 
                        key={idx} 
                        onClick={() => toggleTag(idx)}
                        className={`relative aspect-square rounded-3xl overflow-hidden cursor-pointer transition-all duration-200 ${
                          isSelected 
                          ? 'border-[6px] border-yellow-400 ring-4 ring-yellow-400/20 shadow-[0_0_30px_rgba(250,204,21,0.2)] z-10 scale-[0.98]' 
                          : 'border-2 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600 grayscale hover:grayscale-0'
                        }`}
                      >
                        <img src={frame.url} className="w-full h-full object-cover" alt="" />
                        
                        <div className="absolute top-4 left-4 bg-black/80 px-3 py-1 rounded-lg text-xs text-white font-mono border border-white/10 shadow-lg">
                          FRAME #{idx}
                        </div>
                        
                        {isSelected && (
                          <div className="absolute top-4 right-4 bg-yellow-400 text-slate-900 rounded-full w-10 h-10 flex items-center justify-center shadow-xl animate-in zoom-in">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Preview */}
              <div className="xl:col-span-1 space-y-6 flex flex-col">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl sticky top-0">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Preview Seleção</h3>
                   
                   <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner group">
                      {activePreviewFrames.length > 0 ? (
                        <>
                          <img 
                            src={activePreviewFrames[safePreviewIndex].url} 
                            className="w-full h-full object-cover" 
                            alt="Preview" 
                          />
                          <button 
                             onClick={() => setShowFullscreen(true)}
                             className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all"
                             title="Ecrã Inteiro"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 opacity-20">
                           <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                           <p className="text-[10px] font-black">Nenhum Frame Selecionado</p>
                           <p className="text-[9px] mt-1">Clica nos frames à esquerda</p>
                        </div>
                      )}
                      
                      {totalSelected > 0 && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/60 rounded text-[9px] font-mono text-white whitespace-nowrap">
                          {safePreviewIndex + 1} / {activePreviewFrames.length}
                        </div>
                      )}
                   </div>

                   <div className="w-full text-center space-y-3">
                      <button 
                        onClick={() => handleSetPreviewMode(previewMode === 'special' ? 'none' : 'special')}
                        disabled={totalSelected === 0}
                        className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${totalSelected > 0 && previewMode === 'special' ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 text-slate-500'}`}
                      >
                         {previewMode === 'special' ? 'PAUSAR PREVIEW' : 'REPRODUZIR SELEÇÃO'}
                      </button>

                      {totalSelected > 0 && (
                        <button 
                          onClick={handleAddState}
                          className="w-full md:hidden py-3 rounded-xl bg-slate-800 text-white text-[10px] font-bold uppercase border border-slate-700"
                        >
                          Confirmar &amp; Nova Ação
                        </button>
                      )}
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setShowFullscreen(false)}>
           <div className="relative max-w-4xl w-full aspect-square md:aspect-video flex items-center justify-center">
             {activePreviewFrames.length > 0 && (
               <img 
                  src={activePreviewFrames[safePreviewIndex].url} 
                  className="max-h-[90vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800"
                  alt="Fullscreen"
               />
             )}
             <div className="absolute top-4 right-4 text-white/50 text-xs font-bold uppercase">Click to Close</div>
           </div>
        </div>
      )}
    </>
  );
};

export default VideoSlicerWorkspace;
