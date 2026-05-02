export function LogoB() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-12 p-12">
      {/* Main lockup */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 mb-2">Light</p>
        <div className="flex items-center gap-3">
          {/* Icon: stacked bars representing voice/content */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="0" y="0" width="36" height="36" rx="10" fill="#6056FA"/>
            <rect x="8" y="20" width="4" height="9" rx="2" fill="white" opacity="0.4"/>
            <rect x="14" y="14" width="4" height="15" rx="2" fill="white" opacity="0.7"/>
            <rect x="20" y="9" width="4" height="20" rx="2" fill="white"/>
            <rect x="26" y="16" width="4" height="13" rx="2" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1A1A1A", letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Dark version */}
      <div className="flex flex-col items-center gap-3 bg-[#1A1A1A] rounded-2xl px-16 py-10">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Dark</p>
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="0" y="0" width="36" height="36" rx="10" fill="#6056FA"/>
            <rect x="8" y="20" width="4" height="9" rx="2" fill="white" opacity="0.4"/>
            <rect x="14" y="14" width="4" height="15" rx="2" fill="white" opacity="0.7"/>
            <rect x="20" y="9" width="4" height="20" rx="2" fill="white"/>
            <rect x="26" y="16" width="4" height="13" rx="2" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#ffffff", letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Icon alone */}
      <div className="flex items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest text-gray-300">Icon only</p>
        <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
          <rect x="0" y="0" width="36" height="36" rx="10" fill="#6056FA"/>
          <rect x="8" y="20" width="4" height="9" rx="2" fill="white" opacity="0.4"/>
          <rect x="14" y="14" width="4" height="15" rx="2" fill="white" opacity="0.7"/>
          <rect x="20" y="9" width="4" height="20" rx="2" fill="white"/>
          <rect x="26" y="16" width="4" height="13" rx="2" fill="white" opacity="0.6"/>
        </svg>
        <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
          <rect x="0" y="0" width="36" height="36" rx="8" fill="#6056FA"/>
          <rect x="8" y="20" width="4" height="9" rx="2" fill="white" opacity="0.4"/>
          <rect x="14" y="14" width="4" height="15" rx="2" fill="white" opacity="0.7"/>
          <rect x="20" y="9" width="4" height="20" rx="2" fill="white"/>
          <rect x="26" y="16" width="4" height="13" rx="2" fill="white" opacity="0.6"/>
        </svg>
      </div>

      <p className="text-xs text-gray-300 font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>B — Voice Bars + Wordmark</p>
    </div>
  );
}
