
import React, { useState } from 'react';
import { sliceGridImage } from '../utils/imageUtils';
import { generateImage } from '../services/geminiService';
import AnimationPlayer from './AnimationPlayer';
import DiagnosticTool from './DiagnosticTool';
import FrameStabilizer from './FrameStabilizer';
import { ModelType } from '../types';

interface AnimationStudioProps {
  onSlicesCreated: (frames: string[]) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  onShowKeyModal: () => void;
}

const AnimationStudio: React.FC<AnimationStudioProps> = ({ 
  onSlicesCreated, 
  isGenerating, 
  setIsGenerating,
  onShowKeyModal
}) => {
  const [frames, setFrames] = useState<string[]>([]);
  const [gridUrl, setGridUrl] = useState<string | null>(null);
  const [fps, setFps] = useState(12);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showStabilizer, setShowStabilizer] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-image-preview');

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualGridUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalProcessing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const imgUrl = reader.result as string;
          setGridUrl(imgUrl);
          const result = await sliceGridImage(imgUrl, 3, 3);
          setFrames(result);
          onSlicesCreated(result);
        } catch (err) {
          console.error("Slicing failed", err);
        } finally {
          setLocalProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const updateFrames = (newFrames: string[]) => {
    setFrames(newFrames);
    onSlicesCreated(newFrames);
  };

  const generateTalkingAnimation = async () => {
    if (!refImage) return;
    
    if (selectedModel === 'gemini-3-pro-image-preview') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        onShowKeyModal();
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    try {
      const talkingPrompt = `Create a professional 3x3 sprite sheet for character mouth animation.
CHARACTER STABILITY (MANDATORY):
- The head, eyes, nose, and shoulders must be STATIC and LOCKED in the exact same coordinates in all 9 frames.
- Imagine the character's head is bolted to a wall. NO MOVEMENT of the head allowed.
ANIMATION:
- Only the mouth and chin should move.
- Sequence: Frame 1 (closed), then 9 stages of fluid lip-syncing opening/closing.
GRID RULES:
- Exactly 3x3 grid. No margins, no borders, no gutters between cells.
- Background must be a solid, flat color or identical across all cells.
Aspect Ratio: 1:1. Single Image.`;

      const generatedUrl = await generateImage(
        talkingPrompt,
        selectedModel,
        { aspectRatio: '1:1', imageSize: '1K' },
        refImage
      );

      setGridUrl(generatedUrl);
      const resultFrames = await sliceGridImage(generatedUrl, 3, 3);
      setFrames(resultFrames);
      onSlicesCreated(resultFrames);
    } catch (err: any) {
      if (err.message === "API_KEY_EXPIRED_OR_INVALID") {
        onShowKeyModal();
      } else {
        setError(err.message || "Failed to generate talking animation.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-8 animate-in fade-in duration-500">
      {showDiagnostic && gridUrl && (
        <DiagnosticTool 
          originalImage={gridUrl} 
          frames={frames} 
          onClose={() => setShowDiagnostic(false)} 
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
            <span className="p-1.5 bg-yellow-400 rounded-lg text-slate-950">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </span>
            Talking Sprites Studio
          </h2>
          <p className="text-sm text-slate-400 mt-1 font-medium">Convert static faces into talking animations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="space-y-6 bg-slate-800/30 p-6 rounded-2xl border border-slate-700/30 shadow-lg">
            <div className="flex items-center justify-between">
               <label className="text-xs font-bold uppercase tracking-widest text-yellow-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center text-[11px] font-black">1</span>
                Upload Character
              </label>
            </div>
            
            <div className="space-y-4">
              {!refImage ? (
                <div className="relative group cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleRefImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-10 text-center group-hover:border-yellow-500/50 group-hover:bg-yellow-500/5 transition-all">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-slate-400 group-hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-200">Upload Character Face</p>
                    <p className="text-[10px] text-slate-500 mt-1">Best results with clear front-facing portraits</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 aspect-square w-48 mx-auto shadow-2xl group ring-4 ring-yellow-400/10">
                    <img src={refImage} className="w-full h-full object-cover" alt="Source" />
                    <button 
                      onClick={() => setRefImage(null)}
                      className="absolute inset-0 bg-slate-950/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      REMOVE IMAGE
                    </button>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-bold uppercase text-slate-500">Model</span>
                       <span className="text-[10px] font-bold uppercase text-yellow-500">Required for Quality</span>
                    </div>
                    <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800">
                      <button 
                        onClick={() => setSelectedModel('gemini-3-pro-image-preview')}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${selectedModel === 'gemini-3-pro-image-preview' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Nano Banana Pro
                      </button>
                      <button 
                        onClick={() => setSelectedModel('gemini-2.5-flash-image')}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${selectedModel === 'gemini-2.5-flash-image' ? 'bg-yellow-400 text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Flash (Fast)
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={generateTalkingAnimation}
                    disabled={isGenerating}
                    className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-500/20 ${
                      isGenerating 
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-yellow-400 to-yellow-300 text-slate-950 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"></div>
                        <span className="text-xs uppercase tracking-wider">Generating Sprites...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-black uppercase tracking-tight">CONVERT IMAGE TO TALKING SPRITES</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] text-center leading-relaxed animate-in fade-in">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="text-center opacity-60 hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-slate-500 mb-2">Have a sprite sheet already?</p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700 hover:border-slate-500 transition-colors">
              <input type="file" accept="image/*" onChange={handleManualGridUpload} className="hidden" />
              <span className="text-[10px] font-bold text-slate-300 uppercase">Slice Existing Grid</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center min-h-[500px] bg-slate-900/80 rounded-[2.5rem] border border-slate-800 shadow-inner relative overflow-hidden">
          {(isGenerating || localProcessing) ? (
            <div className="flex flex-col items-center gap-8 p-8 relative z-10 animate-in fade-in duration-700">
              <div className="relative">
                <div className="w-32 h-32 border-4 border-yellow-400/5 border-t-yellow-400 rounded-full animate-spin duration-[3s]"></div>
                <div className="w-24 h-24 border-4 border-yellow-400/10 border-b-yellow-400 rounded-full animate-spin duration-[2s] absolute top-4 left-4"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-yellow-400 tracking-tighter">NANO</span>
                    <span className="text-[10px] font-bold text-slate-500 tracking-[0.3em] ml-1">PROCESSING</span>
                  </div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-slate-300 font-bold text-sm">Animating Character...</p>
                <p className="text-slate-600 text-xs">Generating 9 consistent frames</p>
              </div>
            </div>
          ) : frames.length > 0 ? (
            <div className="w-full h-full p-6 flex flex-col items-center animate-in zoom-in-95 duration-500">
               {showStabilizer ? (
                 <div className="w-full max-w-lg">
                   <FrameStabilizer frames={frames} onUpdate={updateFrames} />
                   <button 
                     onClick={() => setShowStabilizer(false)}
                     className="mt-4 text-[10px] font-bold text-slate-500 hover:text-white"
                   >
                     Back to Preview
                   </button>
                 </div>
               ) : (
                 <div className="w-full space-y-8">
                   <AnimationPlayer frames={frames} fps={fps} />
                   
                   <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-4">
                     <div className="flex justify-between items-center">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Playback Speed</label>
                       <span className="bg-yellow-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded">{fps} FPS</span>
                     </div>
                     <input 
                       type="range" min="1" max="24" value={fps} 
                       onChange={(e) => setFps(parseInt(e.target.value))}
                       className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                     />
                     
                     <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                          onClick={() => setShowStabilizer(true)}
                          className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-700 rounded-xl text-[10px] font-bold text-slate-300 hover:border-yellow-400/50 hover:text-yellow-400 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          FINE TUNE ALIGNMENT
                        </button>
                        <button 
                          onClick={() => setShowDiagnostic(true)}
                          className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-700 rounded-xl text-[10px] font-bold text-slate-300 hover:border-red-400/50 hover:text-red-400 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          DIAGNOSE JITTER
                        </button>
                     </div>
                   </div>
                 </div>
               )}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center p-12 opacity-20">
              <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-bold uppercase tracking-[0.2em] text-sm">Preview Canvas</p>
              <p className="text-xs mt-2">Animations will appear here after generation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Added missing default export
export default AnimationStudio;
