export function LogoA() {
  const navy = "#0F1F3D";
  const white = "#FFFFFF";
  const offwhite = "#F7F8FA";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 p-12" style={{ background: offwhite }}>
      {/* Light bg version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#C5CDD8" }}>Light</p>
        <div className="flex items-baseline gap-0">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 36, color: navy, letterSpacing: "-1.5px" }}>Brand</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300, fontSize: 36, color: navy, letterSpacing: "-1.5px", opacity: 0.5 }}>Me</span>
        </div>
        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 9, color: "#8A97A8", letterSpacing: "4px" }}>YOUR VOICE. YOUR BRAND.</p>
      </div>

      {/* Dark bg version */}
      <div className="flex flex-col items-center gap-3 rounded-2xl px-16 py-10" style={{ background: navy }}>
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#3A5070" }}>Dark</p>
        <div className="flex items-baseline gap-0">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 36, color: white, letterSpacing: "-1.5px" }}>Brand</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300, fontSize: 36, color: white, letterSpacing: "-1.5px", opacity: 0.4 }}>Me</span>
        </div>
        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 9, color: "#3A5070", letterSpacing: "4px" }}>YOUR VOICE. YOUR BRAND.</p>
      </div>

      {/* Small sizes */}
      <div className="flex items-center gap-8">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#C5CDD8" }}>Small</p>
        <div className="flex items-baseline">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: navy, letterSpacing: "-0.8px" }}>Brand</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300, fontSize: 20, color: navy, letterSpacing: "-0.8px", opacity: 0.5 }}>Me</span>
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: navy }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 900, fontSize: 14, color: white }}>B</span>
        </div>
      </div>

      <p className="text-xs font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#C5CDD8" }}>A — Weighted Wordmark</p>
    </div>
  );
}
