
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Character, CharacterAction } from '../types';
import { decodeBase64, decodeAudioData } from '../utils/audioUtils';
import { removeColorBackground } from '../utils/imageUtils';

const SpeechLab: React.FC = () => {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [textToSpeak, setTextToSpeak] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  
  // New State for Action Selection
  const [idleActionId, setIdleActionId] = useState<string>('');
  const [talkingActionId, setTalkingActionId] = useState<string>('');

  // Background Removal State
  const [bgTolerance, setBgTolerance] = useState(30);
  const [isProcessingBg, setIsProcessingBg] = useState(false);

  // Scene Composition State
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [charPosition, setCharPosition] = useState({ x: 0, y: 0 });
  const [charScale, setCharScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        let character: Character;

        // Detect Format: New Action Pack vs Legacy
        if (json.actions && Array.isArray(json.actions)) {
           character = {
             id: json.id || Date.now().toString(),
             name: json.name || "Action Pack",
             actions: json.actions
           };
        } else if (json.idle && json.talking) {
           character = {
             id: json.id || Date.now().toString(),
             name: json.name || "Legacy Character",
             actions: [
               { name: "Idle (Legacy)", frames: json.idle },
               { name: "Talking (Legacy)", frames: json.talking }
             ]
           };
        } else {
          throw new Error("Formato desconhecido.");
        }

        if (character.actions.length === 0) throw new Error("Sem ações no ficheiro.");

        setActiveCharacter(character);
        setIdleActionId(character.actions[0].name);
        setTalkingActionId(character.actions.length > 1 ? character.actions[1].name : character.actions[0].name);
        // Reset position on new load
        setCharPosition({ x: 0, y: 0 }); 

      } catch (err: any) {
        alert("Erro ao carregar asset: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBackground = async () => {
    if (!activeCharacter) return;
    setIsProcessingBg(true);

    try {
      const newActions: CharacterAction[] = [];
      for (const action of activeCharacter.actions) {
        const processedFrames = await Promise.all(
            action.frames.map(async (frameUrl) => {
                return await removeColorBackground(frameUrl, bgTolerance);
            })
        );
        newActions.push({ ...action, frames: processedFrames });
      }

      setActiveCharacter({
          ...activeCharacter,
          actions: newActions
      });
    } catch (err) {
      console.error("BG Removal Failed", err);
      alert("Erro ao remover fundo.");
    } finally {
      setIsProcessingBg(false);
    }
  };

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - charPosition.x,
      y: e.clientY - charPosition.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setCharPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);


  // Helper to get frames
  const getActiveFrames = (actionId: string) => {
    if (!activeCharacter) return [];
    const action = activeCharacter.actions.find(a => a.name === actionId);
    return action ? action.frames : [];
  };

  // Animation Loop
  useEffect(() => {
    let lastUpdate = 0;
    const fps = isSpeaking ? 12 : 4; 
    const interval = 1000 / fps;

    const animate = (time: number) => {
      if (time - lastUpdate > interval && activeCharacter) {
        const currentActionId = isSpeaking ? talkingActionId : idleActionId;
        const frames = getActiveFrames(currentActionId);
        if (frames.length > 0) {
            setCurrentFrameIndex(prev => (prev + 1) % frames.length);
        }
        lastUpdate = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpeaking, activeCharacter, idleActionId, talkingActionId]);

  const handleSpeak = async () => {
    if (!textToSpeak.trim() || !activeCharacter) return;

    setIsGeneratingAudio(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        setIsSpeaking(true);
        source.start();
      }
    } catch (err: any) {
      console.error("TTS Error:", err);
      alert("Falha ao gerar voz: " + (err?.message || "Unknown error"));
      setIsSpeaking(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const currentFrames = isSpeaking ? getActiveFrames(talkingActionId) : getActiveFrames(idleActionId);
  const currentImage = currentFrames[currentFrameIndex % currentFrames.length];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
            Asset Loader
          </h3>
          
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:border-orange-500/50 hover:bg-orange-500/5 transition-all cursor-pointer group"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
              <svg className="w-8 h-8 text-slate-500 mx-auto mb-2 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-xs font-bold text-slate-300">CARREGAR ASSET JSON</p>
            </div>

            {activeCharacter && (
              <div className="space-y-6 animate-in slide-in-from-top-2">
                  {/* Actions Selection */}
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-3">
                    <div>
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Asset Ativo</p>
                        <p className="text-sm font-bold text-white truncate">{activeCharacter.name}</p>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-orange-500/20">
                        <div className="grid grid-cols-2 gap-2">
                           <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Repouso</label>
                              <select 
                                  value={idleActionId} 
                                  onChange={(e) => setIdleActionId(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-white p-2"
                              >
                                  {activeCharacter.actions.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Fala</label>
                              <select 
                                  value={talkingActionId} 
                                  onChange={(e) => setTalkingActionId(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-white p-2"
                              >
                                  {activeCharacter.actions.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                              </select>
                           </div>
                        </div>
                    </div>
                  </div>

                  {/* Scene Control */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cenário / Background</span>
                     </div>

                     {!backgroundImage ? (
                       <button 
                         onClick={() => bgInputRef.current?.click()}
                         className="w-full py-3 border border-slate-700 hover:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2"
                       >
                         <input type="file" ref={bgInputRef} onChange={handleBgUpload} accept="image/*" className="hidden" />
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         Carregar Imagem de Fundo
                       </button>
                     ) : (
                       <div className="relative rounded-lg overflow-hidden border border-slate-700 group">
                          <img src={backgroundImage} className="w-full h-16 object-cover opacity-50" alt="bg" />
                          <button 
                             onClick={() => setBackgroundImage(null)}
                             className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             REMOVER CENÁRIO
                          </button>
                       </div>
                     )}
                     
                     <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                           <label className="text-[9px] text-slate-500 font-bold">Escala do Personagem</label>
                           <span className="text-[9px] text-orange-400 font-mono">{charScale.toFixed(1)}x</span>
                        </div>
                        <input 
                           type="range" min="0.1" max="2" step="0.1"
                           value={charScale}
                           onChange={(e) => setCharScale(parseFloat(e.target.value))}
                           className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <button onClick={() => { setCharPosition({x:0, y:0}); setCharScale(1); }} className="text-[9px] text-slate-600 hover:text-orange-400 w-full text-right underline">
                           Reset Posição
                        </button>
                     </div>
                  </div>

                  {/* Tools */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                     <div className="space-y-2">
                        <div className="flex justify-between items-end">
                           <label className="text-[9px] text-slate-500 font-bold">Tolerância (BG Removal)</label>
                           <span className="text-[9px] text-orange-400 font-mono">{bgTolerance}</span>
                        </div>
                        <input 
                          type="range" min="1" max="100" 
                          value={bgTolerance} 
                          onChange={(e) => setBgTolerance(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                     </div>

                     <button 
                       onClick={handleRemoveBackground}
                       disabled={isProcessingBg}
                       className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase rounded-lg border border-slate-700 hover:border-orange-500/50 transition-all flex items-center justify-center gap-2"
                     >
                       {isProcessingBg ? (
                         <>
                            <div className="w-3 h-3 border-2 border-slate-500 border-t-white rounded-full animate-spin"></div>
                            Processando...
                         </>
                       ) : (
                         "Remover Fundo Branco"
                       )}
                     </button>
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col items-center min-h-[500px] relative overflow-hidden">
          {activeCharacter ? (
            <div className="w-full flex flex-col items-center gap-6 h-full">
              
              {/* STAGE AREA */}
              <div 
                 ref={stageRef}
                 className="relative w-full aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-black transition-all"
                 style={{ 
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : `url('https://www.transparenttextures.com/patterns/carbon-fibre.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                 }}
              >
                 {currentImage && (
                    <div
                       onMouseDown={handleMouseDown}
                       className={`absolute cursor-move select-none transition-transform duration-75 ${isDragging ? 'opacity-80' : 'opacity-100'}`}
                       style={{
                          left: '50%',
                          top: '50%',
                          transform: `translate(calc(-50% + ${charPosition.x}px), calc(-50% + ${charPosition.y}px)) scale(${charScale})`,
                          touchAction: 'none'
                       }}
                    >
                       <img 
                          src={currentImage} 
                          className={`max-h-[300px] object-contain pointer-events-none ${isSpeaking && !backgroundImage ? 'drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'drop-shadow-2xl'}`}
                          alt="Character"
                       />
                       
                       {/* Drag Outline Hint */}
                       <div className="absolute inset-0 border-2 border-yellow-400/0 hover:border-yellow-400/50 rounded-lg transition-colors pointer-events-none"></div>
                    </div>
                 )}
                 
                 <div className="absolute top-4 left-4 flex gap-2">
                    <div className="px-2 py-1 bg-black/60 rounded text-[9px] text-white font-bold backdrop-blur border border-white/10">
                        {isSpeaking ? `FALA: ${talkingActionId}` : `REPOUSO: ${idleActionId}`}
                    </div>
                    {isDragging && <div className="px-2 py-1 bg-yellow-400 text-black rounded text-[9px] font-bold">MOVENDO</div>}
                 </div>
              </div>

              {/* INPUT AREA */}
              <div className="w-full flex gap-4">
                <textarea 
                  value={textToSpeak}
                  onChange={(e) => setTextToSpeak(e.target.value)}
                  placeholder={`Escreve algo para o ${activeCharacter.name}...`}
                  className="flex-1 h-24 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-orange-500/30 resize-none transition-all shadow-inner text-sm"
                />
                
                <button
                  onClick={handleSpeak}
                  disabled={isSpeaking || isGeneratingAudio || !textToSpeak.trim()}
                  className={`w-32 h-24 rounded-2xl font-black uppercase text-xs transition-all flex flex-col items-center justify-center gap-2 shadow-xl ${
                    isSpeaking || isGeneratingAudio || !textToSpeak.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-br from-orange-500 to-yellow-500 text-slate-950 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isGeneratingAudio ? (
                    <>
                       <div className="w-6 h-6 border-2 border-slate-900/20 border-t-slate-950 rounded-full animate-spin"></div>
                       <span>Gerando...</span>
                    </>
                  ) : isSpeaking ? (
                    <>
                       <div className="flex gap-1 h-4 items-end">
                          {[1,2,3].map(i => <div key={i} className="w-1 bg-slate-950 animate-pulse h-full"></div>)}
                       </div>
                       <span>Falando...</span>
                    </>
                  ) : (
                    <>
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                       <span>Falar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 opacity-30 mt-20">
               <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                 <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               </div>
               <p className="font-bold uppercase tracking-widest">Aguardando Asset</p>
               <p className="text-xs mt-2">Carrega o ficheiro JSON gerado no Video Slicer.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeechLab;
