export function LogoC() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-12 p-12">
      {/* Light version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 mb-2">Light</p>
        <div className="flex items-center gap-4">
          {/* Overlapping B+M monogram */}
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="22" fill="#F3F2FF"/>
            {/* B shape */}
            <text x="7" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="#6056FA" opacity="0.9">B</text>
            {/* m shape offset */}
            <text x="18" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="#1A1A1A" opacity="0.85">m</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, color: "#1A1A1A", letterSpacing: "-0.8px", lineHeight: 1 }}>BrandMe</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 10, color: "#A3A3A3", letterSpacing: "3px", marginTop: 3 }}>LINKEDIN · AI</div>
          </div>
        </div>
      </div>

      {/* Dark version */}
      <div className="flex flex-col items-center gap-3 bg-[#1A1A1A] rounded-2xl px-16 py-10">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Dark</p>
        <div className="flex items-center gap-4">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="22" fill="#2A2A2A"/>
            <text x="7" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="#6056FA" opacity="0.9">B</text>
            <text x="18" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="#ffffff" opacity="0.85">m</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, color: "#ffffff", letterSpacing: "-0.8px", lineHeight: 1 }}>BrandMe</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 10, color: "#555", letterSpacing: "3px", marginTop: 3 }}>LINKEDIN · AI</div>
          </div>
        </div>
      </div>

      {/* Standalone mark */}
      <div className="flex items-center gap-8">
        <p className="text-[10px] uppercase tracking-widest text-gray-300">Mark</p>
        <svg width="56" height="56" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="22" fill="#6056FA"/>
          <text x="7" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="white" opacity="0.5">B</text>
          <text x="18" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="white">m</text>
        </svg>
        <svg width="36" height="36" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="22" fill="#6056FA"/>
          <text x="7" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="white" opacity="0.5">B</text>
          <text x="18" y="31" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="26" fill="white">m</text>
        </svg>
      </div>

      <p className="text-xs text-gray-300 font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>C — Monogram Circle</p>
    </div>
  );
}
