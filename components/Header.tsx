
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center rotate-3 shadow-lg shadow-yellow-500/20">
            <svg className="w-6 h-6 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Nano <span className="text-yellow-400">Banana</span> Studio
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a href="#" className="hover:text-yellow-400 transition-colors">Docs</a>
          <a href="#" className="hover:text-yellow-400 transition-colors">Inspiration</a>
          <a href="#" className="bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-700 transition-colors">v1.2.0</a>
        </div>
      </div>
    </header>
  );
};

export default Header;
