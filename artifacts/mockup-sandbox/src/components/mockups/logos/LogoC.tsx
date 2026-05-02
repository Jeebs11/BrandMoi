export function LogoC() {
  const navy = "#0F1F3D";
  const white = "#FFFFFF";
  const offwhite = "#F7F8FA";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 p-12" style={{ background: offwhite }}>
      {/* Light version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#C5CDD8" }}>Light</p>
        <div className="flex items-center gap-4">
          {/* Geometric mark: two overlapping shapes */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="2" y="2" width="22" height="22" rx="5" fill={navy}/>
            <rect x="16" y="16" width="22" height="22" rx="5" fill={navy} opacity="0.25"/>
            <text x="7" y="19" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="15" fill={white}>Bm</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, color: navy, letterSpacing: "-0.8px", lineHeight: 1 }}>BrandMe</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 9, color: "#8A97A8", letterSpacing: "3.5px", marginTop: 4 }}>LINKEDIN CONTENT AI</div>
          </div>
        </div>
      </div>

      {/* Dark version */}
      <div className="flex flex-col items-center gap-3 rounded-2xl px-14 py-10" style={{ background: navy }}>
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#3A5070" }}>Dark</p>
        <div className="flex items-center gap-4">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="2" y="2" width="22" height="22" rx="5" fill={white}/>
            <rect x="16" y="16" width="22" height="22" rx="5" fill={white} opacity="0.2"/>
            <text x="7" y="19" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="15" fill={navy}>Bm</text>
          </svg>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, color: white, letterSpacing: "-0.8px", lineHeight: 1 }}>BrandMe</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 9, color: "#3A5070", letterSpacing: "3.5px", marginTop: 4 }}>LINKEDIN CONTENT AI</div>
          </div>
        </div>
      </div>

      {/* Standalone mark */}
      <div className="flex items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#C5CDD8" }}>Mark</p>
        <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
          <rect x="2" y="2" width="22" height="22" rx="5" fill={navy}/>
          <rect x="16" y="16" width="22" height="22" rx="5" fill={navy} opacity="0.25"/>
          <text x="7" y="19" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="15" fill={white}>Bm</text>
        </svg>
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <rect x="2" y="2" width="22" height="22" rx="5" fill={navy}/>
          <rect x="16" y="16" width="22" height="22" rx="5" fill={navy} opacity="0.25"/>
          <text x="7" y="19" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="15" fill={white}>Bm</text>
        </svg>
        <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
          <rect x="2" y="2" width="22" height="22" rx="5" fill={navy}/>
          <rect x="16" y="16" width="22" height="22" rx="5" fill={navy} opacity="0.25"/>
          <text x="7" y="19" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="15" fill={white}>Bm</text>
        </svg>
      </div>

      <p className="text-xs font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C5CDD8" }}>C — Offset Block Monogram</p>
    </div>
  );
}
