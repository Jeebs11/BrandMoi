export function LogoA() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-12 p-12">
      {/* Light bg version */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-300 mb-2">Light</p>
        <div className="flex items-baseline gap-0">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 36, color: "#1A1A1A", letterSpacing: "-1.5px" }}>Brand</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 36, color: "#6056FA", letterSpacing: "-1.5px" }}>Me</span>
        </div>
        <p className="text-[9px] uppercase tracking-[4px] text-gray-300" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Your voice. Your brand.</p>
      </div>

      {/* Dark bg version */}
      <div className="flex flex-col items-center gap-3 bg-[#1A1A1A] rounded-2xl px-16 py-10">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Dark</p>
        <div className="flex items-baseline gap-0">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 36, color: "#ffffff", letterSpacing: "-1.5px" }}>Brand</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 36, color: "#6056FA", letterSpacing: "-1.5px" }}>Me</span>
        </div>
        <p className="text-[9px] uppercase tracking-[4px] text-gray-600" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Your voice. Your brand.</p>
      </div>

      {/* Small / favicon */}
      <div className="flex items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest text-gray-300">Small</p>
        <div className="flex items-baseline">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: "#1A1A1A", letterSpacing: "-0.8px" }}>Brand</span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: "#6056FA", letterSpacing: "-0.8px" }}>Me</span>
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#6056FA" }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 900, fontSize: 14, color: "#fff" }}>B</span>
        </div>
      </div>

      <p className="text-xs text-gray-300 font-medium tracking-wide" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>A — Wordmark Split</p>
    </div>
  );
}
