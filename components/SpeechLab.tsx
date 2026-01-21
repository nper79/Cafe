
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Character, CharacterAction, SceneConfig } from '../types';
import { decodeBase64, decodeAudioData } from '../utils/audioUtils';
import { removeColorBackground } from '../utils/imageUtils';

const SpeechLab: React.FC = () => {
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [textToSpeak, setTextToSpeak] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  
  // Frame Indices
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  
  // Action Selection State
  const [idleActionId, setIdleActionId] = useState<string>('');
  const [talkingActionId, setTalkingActionId] = useState<string>('');
  const [blinkActionId, setBlinkActionId] = useState<string>(''); 

  // Blinking Logic State
  const [isBlinking, setIsBlinking] = useState(false);
  const nextBlinkTimeRef = useRef<number>(Date.now() + 3000); 

  // Background Removal State
  const [bgTolerance, setBgTolerance] = useState(30);
  const [isProcessingBg, setIsProcessingBg] = useState(false);

  // Scene Composition State
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  
  // Transform States
  const [editMode, setEditMode] = useState<'character' | 'background'>('character'); 
  const [charPosition, setCharPosition] = useState({ x: 0, y: 0 });
  const [charScale, setCharScale] = useState(1);
  const [bgPosition, setBgPosition] = useState({ x: 0, y: 0 });
  const [bgScale, setBgScale] = useState(1);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Background Music State (MP3)
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [bgMusicName, setBgMusicName] = useState<string>('');
  
  // Audio & Animation Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null); 
  const animationRef = useRef<number | null>(null);
  
  // Lip Sync Smoothing Ref
  const currentVolumeRef = useRef<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        let character: Character;

        if (json.actions && Array.isArray(json.actions)) {
           character = {
             id: json.id || Date.now().toString(),
             name: json.name || "Action Pack",
             actions: json.actions,
             sceneConfig: json.sceneConfig // Load scene config if exists
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
        
        // Restore Positions & Scene Config if available
        if (character.sceneConfig) {
            setCharPosition(character.sceneConfig.charPosition || {x:0, y:0});
            setCharScale(character.sceneConfig.charScale || 1);
            setBgPosition(character.sceneConfig.bgPosition || {x:0, y:0});
            setBgScale(character.sceneConfig.bgScale || 1);
            
            // Restore Background Image
            if (character.sceneConfig.backgroundImage) {
                setBackgroundImage(character.sceneConfig.backgroundImage);
            } else {
                setBackgroundImage(null);
            }

            // Restore Music
            if (character.sceneConfig.bgMusicData) {
                setBgMusicUrl(character.sceneConfig.bgMusicData);
                setBgMusicName(character.sceneConfig.bgMusicName || "Music Loaded from JSON");
            } else {
                setBgMusicUrl(null);
                setBgMusicName('');
            }
        } else {
            // Reset to defaults if new character has no config
            setCharPosition({ x: 0, y: 0 });
            setCharScale(1);
            setBgPosition({ x: 0, y: 0 });
            setBgScale(1);
            setBackgroundImage(null);
            setBgMusicUrl(null);
            setBgMusicName('');
        }

        setIdleActionId(character.actions[0].name);
        setTalkingActionId(character.actions.length > 1 ? character.actions[1].name : character.actions[0].name);
        
        const blinkAction = character.actions.find(a => a.name.toLowerCase().includes('blink') || a.name.toLowerCase().includes('piscar'));
        if (blinkAction) setBlinkActionId(blinkAction.name);
        else setBlinkActionId(''); 
        
        // Reset blinking timer
        nextBlinkTimeRef.current = Date.now() + 3000;
        setIsBlinking(false);

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
        setEditMode('background'); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgMusicUrl(url);
      setBgMusicName(file.name);
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
  
  const handleExportJson = async () => {
    if (!activeCharacter) return;
    
    // Convert Music Blob URL to Base64 if it exists and is not already data URI
    let musicData = null;
    if (bgMusicUrl) {
        if (bgMusicUrl.startsWith('data:')) {
            musicData = bgMusicUrl;
        } else {
            try {
                const response = await fetch(bgMusicUrl);
                const blob = await response.blob();
                musicData = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn("Could not save audio data to JSON", e);
            }
        }
    }

    // Capture CURRENT scene state
    const currentSceneConfig: SceneConfig = {
        charPosition,
        charScale,
        bgPosition,
        bgScale,
        backgroundImage: backgroundImage, // Save the actual background image data
        bgMusicData: musicData,
        bgMusicName: bgMusicName
    };

    const characterWithConfig: Character = {
        ...activeCharacter,
        sceneConfig: currentSceneConfig
    };
    
    const jsonString = JSON.stringify(characterWithConfig, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCharacter.name.replace(/\s+/g, '_')}_Saved.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (blinkActionId) {
        // Reset blinking when action changes
        nextBlinkTimeRef.current = Date.now() + 3000 + (Math.random() * 5000);
        setIsBlinking(false);
    }
  }, [blinkActionId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const currentPos = editMode === 'character' ? charPosition : bgPosition;
    
    dragStartRef.current = {
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;

      if (editMode === 'character') {
        setCharPosition({ x: newX, y: newY });
      } else {
        setBgPosition({ x: newX, y: newY });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, editMode]); 

  const getActiveFrames = (actionId: string) => {
    if (!activeCharacter) return [];
    const action = activeCharacter.actions.find(a => a.name === actionId);
    return action ? action.frames : [];
  };

  // --- MAIN ANIMATION LOOP ---
  useEffect(() => {
    let lastUpdate = 0;
    
    const animate = (time: number) => {
      if (!activeCharacter) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // 1. TRIGGER BLINK (If not speaking and time has passed)
      if (!isSpeaking && !isBlinking && blinkActionId) {
        const now = Date.now();
        if (now > nextBlinkTimeRef.current) {
          setIsBlinking(true);
          setCurrentFrameIndex(0); // Start blink from beginning
          // Set next time far in future to prevent re-trigger during animation
          nextBlinkTimeRef.current = now + 999999; 
          
          // Restart loop with new state
          animationRef.current = requestAnimationFrame(animate);
          return; 
        }
      }

      // If we started speaking during a blink, cancel the blink immediately
      if (isSpeaking && isBlinking) {
        setIsBlinking(false);
      }

      let targetFrames: string[] = [];
      let fps = 10; 
      
      if (isSpeaking) {
        targetFrames = getActiveFrames(talkingActionId);
      } else if (isBlinking && blinkActionId) {
        targetFrames = getActiveFrames(blinkActionId);
        fps = 12; // Slightly faster blink
      } else {
        targetFrames = getActiveFrames(idleActionId);
        fps = 4; // Slow idle breathing
      }

      // 2. LIP SYNC LOGIC
      if (isSpeaking && analyserRef.current && targetFrames.length > 0) {
         const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
         analyserRef.current.getByteFrequencyData(dataArray);
         
         let sum = 0;
         const startBin = 1; 
         const endBin = 32;
         const count = endBin - startBin;
         
         for (let i = startBin; i < endBin; i++) {
            sum += dataArray[i];
         }
         const rawAverage = sum / count;
         
         // Smooth Attack/Decay
         if (rawAverage > currentVolumeRef.current) {
             currentVolumeRef.current += (rawAverage - currentVolumeRef.current) * 0.6; 
         } else {
             currentVolumeRef.current += (rawAverage - currentVolumeRef.current) * 0.2; 
         }
         
         const smoothedVolume = currentVolumeRef.current;
         const threshold = 10; 
         
         if (smoothedVolume < threshold) {
            setCurrentFrameIndex(0); 
         } else {
            const maxVolume = 120; 
            const intensity = Math.min(1, (smoothedVolume - threshold) / maxVolume);
            const totalMouthFrames = targetFrames.length - 1; 
            const frameOffset = Math.ceil(intensity * totalMouthFrames);
            const idx = Math.min(targetFrames.length - 1, Math.max(1, frameOffset));
            setCurrentFrameIndex(idx);
         }

      } 
      // 3. FRAME PROGRESSION LOGIC
      else {
        const interval = 1000 / fps;
        if (time - lastUpdate > interval) {
          if (targetFrames.length > 0) {
            
            if (isBlinking) {
               // --- BLINK MODE: PLAY ONCE ---
               const isLastFrame = currentFrameIndex >= targetFrames.length - 1;
               if (isLastFrame) {
                 // Blink Finished. Stop.
                 setIsBlinking(false);
                 setCurrentFrameIndex(0); // Reset for Idle
                 // Schedule next blink randomly (2s to 6s)
                 nextBlinkTimeRef.current = Date.now() + 2000 + (Math.random() * 4000);
               } else {
                 // Next Blink Frame
                 setCurrentFrameIndex(prev => prev + 1);
               }
            } else {
               // --- IDLE MODE: LOOP ---
               setCurrentFrameIndex(prev => (prev + 1) % targetFrames.length);
            }
          }
          lastUpdate = time;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpeaking, isBlinking, activeCharacter, idleActionId, talkingActionId, blinkActionId]);

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
          // systemInstruction removed to avoid 500 errors
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
        
        if (!analyserRef.current) {
          analyserRef.current = ctx.createAnalyser();
          analyserRef.current.fftSize = 256; 
          analyserRef.current.smoothingTimeConstant = 0.4; 
        }

        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        
        source.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
        
        source.onended = () => {
          setIsSpeaking(false);
          setCurrentFrameIndex(0);
          currentVolumeRef.current = 0;
        };
        
        setIsSpeaking(true);
        source.start();
      }
    } catch (err: any) {
      console.error("TTS Error:", err);
      // More user-friendly error handling
      let msg = err?.message || "Unknown error";
      if (msg.includes("500") || msg.includes("INTERNAL")) {
         msg = "Service temporary unavailable (500). Please try again later or try shorter text.";
      } else if (msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
         msg = "The model refused to generate audio. This usually happens with foreign languages or complex text. Try simplifying your prompt.";
      }
      alert("TTS Falhou: " + msg);
      setIsSpeaking(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  let currentFrames: string[] = [];
  if (isSpeaking) currentFrames = getActiveFrames(talkingActionId);
  else if (isBlinking && blinkActionId) currentFrames = getActiveFrames(blinkActionId);
  else currentFrames = getActiveFrames(idleActionId);

  const currentImage = currentFrames[currentFrameIndex % currentFrames.length] || currentFrames[0];

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

            {/* AUDIO PLAYER (MP3) */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
               <div className="flex items-center gap-2 mb-1 border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Trilha Sonora (MP3)</span>
               </div>
               
               <div className="space-y-2">
                   {!bgMusicUrl ? (
                      <button 
                         onClick={() => musicInputRef.current?.click()}
                         className="w-full py-3 border border-slate-700 hover:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2 group transition-all"
                      >
                         <input type="file" ref={musicInputRef} onChange={handleMusicUpload} accept="audio/*" className="hidden" />
                         <div className="w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 10l12-3" /></svg>
                         </div>
                         Carregar Música
                      </button>
                   ) : (
                      <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] text-white font-bold truncate w-32" title={bgMusicName}>{bgMusicName}</span>
                            <button 
                               onClick={() => { setBgMusicUrl(null); setBgMusicName(''); }}
                               className="text-[9px] text-red-400 hover:text-red-300 uppercase font-bold"
                            >
                               Remover
                            </button>
                         </div>
                         <audio src={bgMusicUrl} controls loop className="w-full h-8 block rounded-lg bg-slate-800" />
                      </div>
                   )}
               </div>
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
                        <div className="space-y-2">
                           <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Repouso (Idle)</label>
                              <select 
                                  value={idleActionId} 
                                  onChange={(e) => setIdleActionId(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-white p-2"
                              >
                                  {activeCharacter.actions.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Fala (Audio-Reactive)</label>
                              <select 
                                  value={talkingActionId} 
                                  onChange={(e) => setTalkingActionId(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-white p-2"
                              >
                                  {activeCharacter.actions.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Piscar (Aleatório 2-6s)</label>
                              <select 
                                  value={blinkActionId} 
                                  onChange={(e) => setBlinkActionId(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-white p-2"
                              >
                                  <option value="">(Desativado)</option>
                                  {activeCharacter.actions.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                              </select>
                           </div>
                        </div>
                    </div>
                  </div>

                  {/* Scene Control */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Composição de Cena</span>
                     </div>

                     <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
                        <button 
                          onClick={() => setEditMode('character')}
                          className={`flex-1 py-2 text-[9px] font-bold uppercase rounded-lg transition-all ${editMode === 'character' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Mover Personagem
                        </button>
                        <button 
                          onClick={() => setEditMode('background')}
                          className={`flex-1 py-2 text-[9px] font-bold uppercase rounded-lg transition-all ${editMode === 'background' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          Mover Fundo
                        </button>
                     </div>

                     {!backgroundImage ? (
                       <button 
                         onClick={() => bgInputRef.current?.click()}
                         className="w-full py-3 border border-slate-700 hover:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2"
                       >
                         <input type="file" ref={bgInputRef} onChange={handleBgUpload} accept="image/*" className="hidden" />
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         Carregar Fundo
                       </button>
                     ) : (
                       <div className="relative rounded-lg overflow-hidden border border-slate-700 group">
                          <img src={backgroundImage} className="w-full h-12 object-cover opacity-50" alt="bg" />
                          <button 
                             onClick={() => setBackgroundImage(null)}
                             className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             REMOVER CENÁRIO
                          </button>
                       </div>
                     )}
                     
                     {editMode === 'character' ? (
                       <div className="space-y-2 pt-2 border-t border-slate-800 animate-in fade-in">
                          <div className="flex justify-between">
                             <label className="text-[9px] text-slate-500 font-bold">Escala do Personagem</label>
                             <span className="text-[9px] text-orange-400 font-mono">{charScale.toFixed(1)}x</span>
                          </div>
                          <input 
                             type="range" min="0.1" max="4" step="0.1"
                             value={charScale}
                             onChange={(e) => setCharScale(parseFloat(e.target.value))}
                             className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                          />
                          <button onClick={() => { setCharPosition({x:0, y:0}); setCharScale(1); }} className="text-[9px] text-slate-600 hover:text-orange-400 w-full text-right underline">
                             Reset Posição (Personagem)
                          </button>
                       </div>
                     ) : (
                        <div className="space-y-2 pt-2 border-t border-slate-800 animate-in fade-in">
                          <div className="flex justify-between">
                             <label className="text-[9px] text-slate-500 font-bold">Escala do Fundo</label>
                             <span className="text-[9px] text-blue-400 font-mono">{bgScale.toFixed(1)}x</span>
                          </div>
                          <input 
                             type="range" min="0.1" max="5" step="0.1"
                             value={bgScale}
                             onChange={(e) => setBgScale(parseFloat(e.target.value))}
                             className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <button onClick={() => { setBgPosition({x:0, y:0}); setBgScale(1); }} className="text-[9px] text-slate-600 hover:text-blue-400 w-full text-right underline">
                             Reset Posição (Fundo)
                          </button>
                       </div>
                     )}
                  </div>

                  {/* Tools / Cleaning */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                     <div className="flex items-center gap-2 mb-1 border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Limpeza & Exportação</span>
                     </div>

                     <div className="space-y-2">
                        <div className="flex justify-between items-end">
                           <label className="text-[9px] text-slate-500 font-bold">Remover Halo (Tolerância)</label>
                           <span className="text-[9px] text-orange-400 font-mono">{bgTolerance}%</span>
                        </div>
                        <input 
                          type="range" min="1" max="100" 
                          value={bgTolerance} 
                          onChange={(e) => setBgTolerance(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                     </div>

                     <div className="grid grid-cols-1 gap-2">
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
                             "Limpar Halo / Fundo"
                           )}
                         </button>
                         
                         <button 
                           onClick={handleExportJson}
                           className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                         >
                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                           Salvar Asset Atualizado
                         </button>
                     </div>
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
                 onMouseDown={handleMouseDown}
                 className={`relative w-full aspect-video rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-black transition-all ${isDragging ? 'cursor-move' : ''}`}
              >
                 {/* Background Layer */}
                 {backgroundImage ? (
                   <img 
                      src={backgroundImage}
                      className="absolute left-1/2 top-1/2 max-w-none origin-center pointer-events-none select-none"
                      style={{
                         transform: `translate(calc(-50% + ${bgPosition.x}px), calc(-50% + ${bgPosition.y}px)) scale(${bgScale})`,
                         minWidth: '100%',
                         minHeight: '100%'
                      }}
                      alt="Background"
                   />
                 ) : (
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
                 )}

                 {/* Character Layer */}
                 {currentImage && (
                    <div
                       className={`absolute select-none transition-transform duration-75 pointer-events-none ${isDragging && editMode === 'character' ? 'opacity-80' : 'opacity-100'}`}
                       style={{
                          left: '50%',
                          top: '50%',
                          transform: `translate(calc(-50% + ${charPosition.x}px), calc(-50% + ${charPosition.y}px)) scale(${charScale})`,
                       }}
                    >
                       <img 
                          src={currentImage} 
                          className={`max-h-[300px] object-contain ${isSpeaking && !backgroundImage ? 'drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'drop-shadow-2xl'}`}
                          alt="Character"
                       />
                    </div>
                 )}

                 {/* Drag Hints */}
                 {isDragging && (
                   <div className="absolute inset-0 border-2 border-yellow-400/50 rounded-lg pointer-events-none flex items-center justify-center">
                      <div className="bg-black/50 px-4 py-2 rounded-full text-white font-bold backdrop-blur">
                         MOVENDO {editMode === 'character' ? 'PERSONAGEM' : 'FUNDO'}
                      </div>
                   </div>
                 )}
                 
                 <div className="absolute top-4 left-4 flex gap-2">
                    <div className="px-2 py-1 bg-black/60 rounded text-[9px] text-white font-bold backdrop-blur border border-white/10">
                        {isSpeaking ? `FALA: ${talkingActionId}` : isBlinking ? `PISCAR: ${blinkActionId}` : `REPOUSO: ${idleActionId}`}
                    </div>
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
