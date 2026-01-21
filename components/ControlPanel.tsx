
import React from 'react';
import { ModelType, AspectRatio, ImageSize } from '../types';

interface ControlPanelProps {
  model: ModelType;
  setModel: (model: ModelType) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  imageSize: ImageSize;
  setImageSize: (size: ImageSize) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  base64Image: string | null;
  removeUpload: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  model, setModel, aspectRatio, setAspectRatio, imageSize, setImageSize, handleImageUpload, base64Image, removeUpload
}) => {
  return (
    <div className="space-y-8 bg-slate-900/30 p-1 rounded-2xl">
      {/* Model Selection */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">AI Engine</label>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setModel('gemini-2.5-flash-image')}
            className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
              model === 'gemini-2.5-flash-image'
                ? 'bg-slate-800 border-yellow-500/50 ring-1 ring-yellow-500/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className={`text-sm font-semibold ${model === 'gemini-2.5-flash-image' ? 'text-yellow-400' : 'text-slate-200'}`}>
              2.5 Flash Image
            </span>
            <span className="text-[10px] text-slate-500 mt-1">Faster, supports Image-to-Image editing</span>
          </button>
          <button
            onClick={() => setModel('gemini-3-pro-image-preview')}
            className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
              model === 'gemini-3-pro-image-preview'
                ? 'bg-slate-800 border-yellow-500/50 ring-1 ring-yellow-500/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold ${model === 'gemini-3-pro-image-preview' ? 'text-yellow-400' : 'text-slate-200'}`}>
                3.0 Pro Preview
              </span>
              <span className="bg-yellow-500/10 text-yellow-500 text-[8px] px-1 rounded border border-yellow-500/20 uppercase font-bold">Paid Tier</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">High fidelity, 4K resolution, flexible aspect ratios</span>
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Settings</label>
        
        <div className="space-y-2">
          <label className="text-xs text-slate-400 block ml-1">Aspect Ratio</label>
          <div className="grid grid-cols-3 gap-1">
            {(['1:1', '3:4', '4:3', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`text-xs py-2 rounded-lg border transition-all ${
                  aspectRatio === ratio
                    ? 'bg-slate-800 border-yellow-500/50 text-yellow-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {model === 'gemini-3-pro-image-preview' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-xs text-slate-400 block ml-1">Target Resolution</label>
            <div className="grid grid-cols-3 gap-1">
              {(['1K', '2K', '4K'] as ImageSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setImageSize(size)}
                  className={`text-xs py-2 rounded-lg border transition-all ${
                    imageSize === size
                      ? 'bg-slate-800 border-yellow-500/50 text-yellow-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Upload for Editing */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Edit Reference</label>
        {!base64Image ? (
          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="border-2 border-dashed border-slate-800 rounded-xl p-6 text-center group-hover:border-slate-600 group-hover:bg-slate-900 transition-all">
              <svg className="w-6 h-6 text-slate-500 mx-auto mb-2 group-hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[10px] text-slate-500 font-medium">Click to upload image</span>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-slate-700 group">
            <img src={base64Image} alt="Ref" className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={removeUpload}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 p-2">
              <span className="text-[10px] font-bold text-yellow-400 uppercase">Edit Mode Active</span>
            </div>
          </div>
        )}
        <p className="text-[10px] text-slate-600 leading-tight">
          Editing requires 2.5 Flash model. Uploading an image will auto-switch the engine.
        </p>
      </div>
    </div>
  );
};

export default ControlPanel;
