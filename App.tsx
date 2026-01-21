
import React, { useState, useEffect } from 'react';
import { ModelType, AspectRatio, ImageSize, GeneratedImage } from './types';
import { generateImage } from './services/geminiService';
import { sliceGridImage } from './utils/imageUtils';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import ImageDisplay from './components/ImageDisplay';
import ApiKeyModal from './components/ApiKeyModal';
import AnimationStudio from './components/AnimationStudio';
import { useVideoSlicer, VideoSlicerSidebar, VideoSlicerWorkspace } from './components/VideoSlicer';
import SpeechLab from './components/SpeechLab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'animate' | 'video' | 'speech'>('generate');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelType>('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Generating magic...');

  // Initialize Video Slicer State Hook
  const videoSlicerState = useVideoSlicer();

  const messages = [
    "Nano-particles are aligning...",
    "Peeling back the layers of reality...",
    "Sweetening the pixels with banana essence...",
    "Gemini is dreaming up your vision...",
    "Polishing the yellow curves...",
    "Almost ripe...",
  ];

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      let i = 0;
      interval = setInterval(() => {
        setLoadingMessage(messages[i % messages.length]);
        i++;
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleKeySelection = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setShowKeyModal(false);
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !base64Image) {
      setError("Please provide a prompt or an image to edit.");
      return;
    }

    if (model === 'gemini-3-pro-image-preview') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setShowKeyModal(true);
        return;
      }
    }

    setIsGenerating(true);
    setError(null);

    try {
      const imageUrl = await generateImage(
        prompt,
        model,
        { aspectRatio, imageSize },
        base64Image || undefined
      );

      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: imageUrl,
        prompt: prompt || (base64Image ? "Image Edited" : "Generated"),
        model,
        timestamp: Date.now(),
      };

      setImages(prev => [newImage, ...prev]);
    } catch (err: any) {
      if (err.message === "API_KEY_EXPIRED_OR_INVALID") {
        setError("Your API key session has expired or is invalid. Please select a key again.");
        setShowKeyModal(true);
      } else {
        setError(err.message || "Something went wrong while generating your image.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSliceImage = async (image: GeneratedImage) => {
    try {
      setIsGenerating(true);
      setError(null);
      setLoadingMessage("Slicing into grid components...");
      const slicedUrls = await sliceGridImage(image.url, 3, 3);
      
      const newSlices: GeneratedImage[] = slicedUrls.map((url, index) => ({
        id: `${image.id}-slice-${index}`,
        url,
        prompt: `${image.prompt} (Part ${index + 1})`,
        model: 'manual-slice',
        timestamp: Date.now(),
        isSlice: true
      }));

      setImages(prev => [...newSlices, ...prev]);
      setActiveTab('animate'); 
    } catch (err: any) {
      setError("Failed to slice image. Make sure it's a valid 3x3 grid.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnimationFramesCreated = (frames: string[]) => {
    const newFrames: GeneratedImage[] = frames.map((url, index) => ({
      id: `anim-frame-${Date.now()}-${index}`,
      url,
      prompt: `Animation Frame ${index + 1}`,
      model: 'animation-frame',
      timestamp: Date.now(),
      isSlice: true
    }));
    setImages(prev => [...newFrames, ...prev]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Image(reader.result as string);
        setModel('gemini-2.5-flash-image');
      };
      reader.readAsDataURL(file);
    }
  };

  const removeUpload = () => {
    setBase64Image(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          {/* Navigation Buttons */}
          <div className="bg-slate-900/50 p-2 rounded-2xl border border-slate-800 flex flex-col gap-1 shadow-lg">
            <button 
              onClick={() => setActiveTab('generate')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'generate' ? 'bg-yellow-400 text-slate-950 shadow-yellow-500/20 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Image Studio
            </button>
            <button 
              onClick={() => setActiveTab('speech')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'speech' ? 'bg-orange-500 text-white shadow-orange-500/20 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              Speech Lab
            </button>
            <button 
              onClick={() => setActiveTab('animate')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'animate' ? 'bg-yellow-400 text-slate-950 shadow-yellow-500/20 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Talking Sprites
            </button>
            <button 
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'video' ? 'bg-blue-500 text-white shadow-blue-500/20 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Video Slicer
            </button>
          </div>

          {/* Conditional Sidebar Content */}
          {activeTab === 'generate' && (
            <ControlPanel 
              model={model}
              setModel={setModel}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              imageSize={imageSize}
              setImageSize={setImageSize}
              handleImageUpload={handleImageUpload}
              base64Image={base64Image}
              removeUpload={removeUpload}
            />
          )}

          {activeTab === 'video' && (
             <div className="bg-slate-900/30 p-4 rounded-2xl border border-slate-800">
               <VideoSlicerSidebar {...videoSlicerState} />
             </div>
          )}
        </aside>

        <section className="lg:col-span-3 space-y-8">
          {activeTab === 'generate' ? (
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
              <label className="text-sm font-medium text-slate-400">Creation Workspace</label>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={base64Image ? "Describe how to edit the image (e.g. 'Make it pixel art style')..." : "Enter your creative prompt here..."}
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`absolute bottom-4 right-4 px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${
                    isGenerating ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-yellow-400 text-slate-950 hover:bg-yellow-300 active:scale-95'
                  }`}
                >
                  {isGenerating ? 'Cooking...' : (base64Image ? 'Edit' : 'Generate')}
                </button>
              </div>
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Request Failed</p>
                    <p className="opacity-80">{error}</p>
                    <button onClick={() => setError(null)} className="mt-2 text-[10px] uppercase tracking-wider font-bold hover:underline">Dismiss</button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'animate' ? (
            <AnimationStudio 
              onSlicesCreated={handleAnimationFramesCreated} 
              isGenerating={isGenerating} 
              setIsGenerating={setIsGenerating}
              onShowKeyModal={() => setShowKeyModal(true)}
            />
          ) : activeTab === 'speech' ? (
            <SpeechLab />
          ) : (
            // Replaced generic VideoSlicer with specific Workspace component using hooked state
            <VideoSlicerWorkspace {...videoSlicerState} />
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Gallery
            </h2>
            <ImageDisplay 
              images={images} 
              isGenerating={isGenerating} 
              loadingMessage={loadingMessage} 
              onSlice={handleSliceImage}
            />
          </div>
        </section>
      </main>

      {showKeyModal && <ApiKeyModal onSelect={handleKeySelection} />}

      <footer className="py-8 text-center text-slate-500 text-xs border-t border-slate-900">
        &copy; {new Date().getFullYear()} Nano Banana Image Studio &bull; Powered by Gemini 3.0
      </footer>
    </div>
  );
};

export default App;
