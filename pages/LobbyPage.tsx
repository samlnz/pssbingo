import React from 'react';

interface LobbyPageProps {
  onStart: () => void;
}

const LobbyPage: React.FC<LobbyPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-black/60 backdrop-blur-xl p-10 rounded-3xl border-2 border-cyan-500/40 shadow-[0_0_50px_rgba(0,180,216,0.3)] animate-fade-in text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-white to-cyan-500 animate-shimmer"></div>
        
        <div className="mb-8">
          <div className="text-6xl text-cyan-400 mb-6 animate-float inline-block">
            <i className="fas fa-satellite"></i>
          </div>
          <h1 className="text-5xl md:text-7xl font-['Orbitron'] font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-white mb-2 drop-shadow-lg">
            SYNC BINGO
          </h1>
          <p className="text-xl text-cyan-100/70 tracking-widest uppercase font-light">Global Network Waiting Room</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: 'clock', title: 'Timed Rounds', desc: 'New selection windows open every 5 minutes' },
            { icon: 'broadcast-tower', title: 'Live Spectating', desc: 'Join any ongoing game to watch live calling' },
            { icon: 'shield-alt', title: 'Safe Protocols', desc: 'Verified payouts and deterministic card sets' }
          ].map((item, i) => (
            <div key={i} className="bg-cyan-500/10 p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400 transition-all group">
              <i className={`fas fa-${item.icon} text-3xl text-cyan-400 mb-4 group-hover:scale-110 transition-transform`}></i>
              <h3 className="text-cyan-300 font-bold mb-2 font-['Orbitron']">{item.title}</h3>
              <p className="text-cyan-100/60 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mb-12">
          <button 
            onClick={onStart}
            className="group relative inline-flex items-center gap-4 px-12 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-2xl font-bold shadow-[0_10px_30px_rgba(0,180,216,0.4)] hover:shadow-[0_15px_40px_rgba(0,180,216,0.6)] hover:scale-105 transition-all active:scale-95 text-white"
          >
            <i className="fas fa-sign-in-alt"></i>
            ENTER HUB
            <div className="absolute -inset-1 rounded-full bg-cyan-400/20 blur-md group-hover:blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>

        <div className="bg-black/40 rounded-2xl p-6 border-l-4 border-cyan-500 text-left">
          <h2 className="text-cyan-400 font-bold mb-4 flex items-center gap-3 font-['Orbitron']">
            <i className="fas fa-info-circle"></i>
            SYSTEM STATUS
          </h2>
          <p className="text-cyan-100/70 text-sm leading-relaxed mb-4">
            A game cycle is currently concluding or about to begin. If you missed the selection window, you will enter as a spectator until the next round.
          </p>
          <ul className="space-y-3 text-cyan-100/70 text-xs">
            <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> Automatic transition to Selection Phase every cycle.</li>
            <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> Live broadcasting is always available for active nodes.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;