
import React from 'react';

interface ApiKeyModalProps {
  onSelect: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
      <div className="relative bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-yellow-400/20">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-100">Unlock Pro Models</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Gemini 3.0 Pro requires a paid API key from your Google Cloud project. 
            Select your key to continue with high-fidelity generation.
          </p>
          
          <div className="pt-6 space-y-3">
            <button
              onClick={onSelect}
              className="w-full bg-yellow-400 text-slate-950 font-bold py-3 rounded-xl hover:bg-yellow-300 transition-all shadow-lg active:scale-[0.98]"
            >
              Select API Key
            </button>
            <p className="text-[10px] text-slate-500">
              Need more info? Read about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener" className="text-yellow-500 hover:underline">Gemini API billing</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
