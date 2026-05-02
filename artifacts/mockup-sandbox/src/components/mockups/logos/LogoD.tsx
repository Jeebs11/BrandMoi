export function LogoD() {
  const navy = "#0F1F3D";
  const white = "#FFFFFF";
  const offwhite = "#F7F8FA";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 p-12" style={{ background: offwhite }}>
      {/* Light version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#C5CDD8" }}>Light</p>
        <div className="flex items-center gap-3">
          {/* Fingerprint / voice DNA concentric arcs */}
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <path d="M21 38C11.6 38 4 30.4 4 21C4 11.6 11.6 4 21 4C30.4 4 38 11.6 38 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.15"/>
            <path d="M21 32C14.4 32 9 27 9 21C9 15 14.4 10 21 10C27.6 10 33 15 33 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.35"/>
            <path d="M21 26C17.7 26 15 23.8 15 21C15 18.2 17.7 16 21 16C24.3 16 27 18.2 27 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.65"/>
            <path d="M21 21C19.8 21 19 20.3 19 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <circle cx="21" cy="21" r="2.8" fill={navy}/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: navy, letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Dark version */}
      <div className="flex flex-col items-center gap-3 rounded-2xl px-14 py-10" style={{ background: navy }}>
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#3A5070" }}>Dark</p>
        <div className="flex items-center gap-3">
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <path d="M21 38C11.6 38 4 30.4 4 21C4 11.6 11.6 4 21 4C30.4 4 38 11.6 38 21" stroke={white} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.12"/>
            <path d="M21 32C14.4 32 9 27 9 21C9 15 14.4 10 21 10C27.6 10 33 15 33 21" stroke={white} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.3"/>
            <path d="M21 26C17.7 26 15 23.8 15 21C15 18.2 17.7 16 21 16C24.3 16 27 18.2 27 21" stroke={white} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.6"/>
            <circle cx="21" cy="21" r="2.8" fill={white}/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: white, letterSpacing: "-1px" }}>BrandMe</span>
        </div>
      </div>

      {/* Icon sizes */}
      <div className="flex items-center gap-8">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#C5CDD8" }}>Icon</p>
        <svg width="56" height="56" viewBox="0 0 42 42" fill="none">
          <path d="M21 38C11.6 38 4 30.4 4 21C4 11.6 11.6 4 21 4C30.4 4 38 11.6 38 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.15"/>
          <path d="M21 32C14.4 32 9 27 9 21C9 15 14.4 10 21 10C27.6 10 33 15 33 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.35"/>
          <path d="M21 26C17.7 26 15 23.8 15 21C15 18.2 17.7 16 21 16C24.3 16 27 18.2 27 21" stroke={navy} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.65"/>
          <circle cx="21" cy="21" r="2.8" fill={navy}/>
        </svg>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: navy }}>
          <svg width="26" height="26" viewBox="0 0 42 42" fill="none">
            <path d="M21 38C11.6 38 4 30.4 4 21C4 11.6 11.6 4 21 4C30.4 4 38 11.6 38 21" stroke={white} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.2"/>
            <path d="M21 32C14.4 32 9 27 9 21C9 15 14.4 10 21 10C27.6 10 33 15 33 21" stroke={white} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.45"/>
            <path d="M21 26C17.7 26 15 23.8 15 21C15 18.2 17.7 16 21 16C24.3 16 27 18.2 27 21" stroke={white} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
            <circle cx="21" cy="21" r="2.8" fill={white}/>
          </svg>
        </div>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: navy }}>
          <svg width="18" height="18" viewBox="0 0 42 42" fill="none">
            <path d="M21 32C14.4 32 9 27 9 21C9 15 14.4 10 21 10C27.6 10 33 15 33 21" stroke={white} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4"/>
            <path d="M21 26C17.7 26 15 23.8 15 21C15 18.2 17.7 16 21 16C24.3 16 27 18.2 27 21" stroke={white} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8"/>
            <circle cx="21" cy="21" r="2.8" fill={white}/>
          </svg>
        </div>
      </div>

      <p className="text-xs font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C5CDD8" }}>D — Voice DNA Fingerprint</p>
    </div>
  );
}
