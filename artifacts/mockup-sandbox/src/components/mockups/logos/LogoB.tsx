export function LogoB() {
  const navy = "#0F1F3D";
  const white = "#FFFFFF";
  const offwhite = "#F7F8FA";
  const accent = "#2563EB";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 p-12" style={{ background: offwhite }}>
      {/* Light version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#C5CDD8" }}>Light</p>
        <div className="flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <rect width="38" height="38" rx="10" fill={navy}/>
            <rect x="9" y="21" width="3.5" height="9" rx="1.5" fill={white} opacity="0.3"/>
            <rect x="14.5" y="15" width="3.5" height="15" rx="1.5" fill={white} opacity="0.55"/>
            <rect x="20" y="10" width="3.5" height="20" rx="1.5" fill={white}/>
            <rect x="25.5" y="17" width="3.5" height="13" rx="1.5" fill={white} opacity="0.5"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: navy, letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Dark version */}
      <div className="flex flex-col items-center gap-3 rounded-2xl px-14 py-10" style={{ background: navy }}>
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#3A5070" }}>Dark</p>
        <div className="flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <rect width="38" height="38" rx="10" fill={accent}/>
            <rect x="9" y="21" width="3.5" height="9" rx="1.5" fill={white} opacity="0.3"/>
            <rect x="14.5" y="15" width="3.5" height="15" rx="1.5" fill={white} opacity="0.55"/>
            <rect x="20" y="10" width="3.5" height="20" rx="1.5" fill={white}/>
            <rect x="25.5" y="17" width="3.5" height="13" rx="1.5" fill={white} opacity="0.5"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: white, letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Icon sizes */}
      <div className="flex items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#C5CDD8" }}>Icon</p>
        <svg width="48" height="48" viewBox="0 0 38 38" fill="none">
          <rect width="38" height="38" rx="10" fill={navy}/>
          <rect x="9" y="21" width="3.5" height="9" rx="1.5" fill={white} opacity="0.3"/>
          <rect x="14.5" y="15" width="3.5" height="15" rx="1.5" fill={white} opacity="0.55"/>
          <rect x="20" y="10" width="3.5" height="20" rx="1.5" fill={white}/>
          <rect x="25.5" y="17" width="3.5" height="13" rx="1.5" fill={white} opacity="0.5"/>
        </svg>
        <svg width="32" height="32" viewBox="0 0 38 38" fill="none">
          <rect width="38" height="38" rx="8" fill={navy}/>
          <rect x="9" y="21" width="3.5" height="9" rx="1.5" fill={white} opacity="0.3"/>
          <rect x="14.5" y="15" width="3.5" height="15" rx="1.5" fill={white} opacity="0.55"/>
          <rect x="20" y="10" width="3.5" height="20" rx="1.5" fill={white}/>
          <rect x="25.5" y="17" width="3.5" height="13" rx="1.5" fill={white} opacity="0.5"/>
        </svg>
        <svg width="20" height="20" viewBox="0 0 38 38" fill="none">
          <rect width="38" height="38" rx="6" fill={navy}/>
          <rect x="9" y="21" width="3.5" height="9" rx="1.5" fill={white} opacity="0.3"/>
          <rect x="14.5" y="15" width="3.5" height="15" rx="1.5" fill={white} opacity="0.55"/>
          <rect x="20" y="10" width="3.5" height="20" rx="1.5" fill={white}/>
          <rect x="25.5" y="17" width="3.5" height="13" rx="1.5" fill={white} opacity="0.5"/>
        </svg>
      </div>

      <p className="text-xs font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C5CDD8" }}>B — Signal Bars + Wordmark</p>
    </div>
  );
}
