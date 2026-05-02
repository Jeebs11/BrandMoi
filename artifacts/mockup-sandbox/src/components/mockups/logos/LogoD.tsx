export function LogoD() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-12 p-12">
      {/* Light version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 mb-2">Light</p>
        <div className="flex items-center gap-3">
          {/* Fingerprint / voice DNA abstract mark */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            {/* Concentric arcs — fingerprint / voice wave */}
            <path d="M20 36 C10 36 4 29 4 20 C4 11 11 4 20 4 C29 4 36 11 36 20" stroke="#E5E4FF" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M20 30 C13 30 8 25.5 8 20 C8 14.5 13.5 10 20 10 C26.5 10 32 14.5 32 20" stroke="#A5A1FB" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M20 24 C16.5 24 13 22 13 20 C13 18 16 16 20 16 C24 16 27 18 27 20" stroke="#6056FA" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="20" cy="20" r="2.5" fill="#6056FA"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1A1A1A", letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Dark version */}
      <div className="flex flex-col items-center gap-3 bg-[#1A1A1A] rounded-2xl px-16 py-10">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Dark</p>
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M20 36 C10 36 4 29 4 20 C4 11 11 4 20 4 C29 4 36 11 36 20" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M20 30 C13 30 8 25.5 8 20 C8 14.5 13.5 10 20 10 C26.5 10 32 14.5 32 20" stroke="#6056FA" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7"/>
            <path d="M20 24 C16.5 24 13 22 13 20 C13 18 16 16 20 16 C24 16 27 18 27 20" stroke="#6056FA" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="20" cy="20" r="2.5" fill="#6056FA"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#ffffff", letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Standalone icon sizes */}
      <div className="flex items-center gap-8">
        <p className="text-[10px] uppercase tracking-widest text-gray-300">Icon</p>
        <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
          <path d="M20 36 C10 36 4 29 4 20 C4 11 11 4 20 4 C29 4 36 11 36 20" stroke="#E5E4FF" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M20 30 C13 30 8 25.5 8 20 C8 14.5 13.5 10 20 10 C26.5 10 32 14.5 32 20" stroke="#A5A1FB" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M20 24 C16.5 24 13 22 13 20 C13 18 16 16 20 16 C24 16 27 18 27 20" stroke="#6056FA" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <circle cx="20" cy="20" r="2.5" fill="#6056FA"/>
        </svg>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#6056FA" }}>
          <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
            <path d="M20 36 C10 36 4 29 4 20 C4 11 11 4 20 4 C29 4 36 11 36 20" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" fill="none"/>
            <path d="M20 30 C13 30 8 25.5 8 20 C8 14.5 13.5 10 20 10 C26.5 10 32 14.5 32 20" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeLinecap="round" fill="none"/>
            <path d="M20 24 C16.5 24 13 22 13 20 C13 18 16 16 20 16 C24 16 27 18 27 20" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
            <circle cx="20" cy="20" r="2.5" fill="white"/>
          </svg>
        </div>
      </div>

      <p className="text-xs text-gray-300 font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>D — Voice DNA Fingerprint</p>
    </div>
  );
}
