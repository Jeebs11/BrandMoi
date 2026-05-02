import "./landing.css";

const FEATURES = [
  {
    emoji: "🎙",
    title: "Voice DNA",
    desc: "Every post you write teaches it your rhythm. Sentence length. Opening style. Vocabulary. It remembers.",
  },
  {
    emoji: "⚡",
    title: "Explore 3 angles",
    desc: "Not sure which direction? Get a Contrarian, a Story, and a Direct hook for the same idea — instantly.",
  },
  {
    emoji: "📊",
    title: "Performance nudges",
    desc: "Brand OS sees your resonance data and tells you which feeling consistently wins before you start typing.",
  },
  {
    emoji: "📚",
    title: "More like this",
    desc: "One tap on any top post in your library replicates its audience, feeling, and structural pattern.",
  },
];

export function VariantB() {
  return (
    <div className="lp-b min-h-screen font-sans" style={{ background: "#0d0d0f", color: "#fff" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center">
            <span className="text-white text-xs font-black">B</span>
          </div>
          <span className="font-extrabold text-white tracking-tight">Brand OS</span>
        </div>
        <div className="flex items-center gap-6 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          <a href="#how" className="hover:text-white transition">How it works</a>
          <a href="#features" className="hover:text-white transition">Features</a>
        </div>
        <button className="text-sm font-semibold px-4 py-2 rounded-full border transition"
          style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff", background: "rgba(255,255,255,0.06)" }}>
          Join waitlist
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-10 pt-28 pb-20">
        <div className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1.5 mb-8"
          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
          Private beta · Limited spots
        </div>
        <h1 className="text-[68px] font-black leading-[1.0] tracking-tight mb-8" style={{ letterSpacing: "-2px" }}>
          LinkedIn posts<br />
          <span style={{ background: "linear-gradient(90deg, #8b5cf6, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            that sound like you.
          </span>
        </h1>
        <p className="text-xl leading-relaxed mb-12 max-w-lg" style={{ color: "rgba(255,255,255,0.55)" }}>
          Tell Brand OS your idea. Pick your audience and feeling. Get a post in seconds — not in "AI voice", in yours.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="email"
            placeholder="your@email.com"
            className="px-5 py-3.5 rounded-2xl text-sm focus:outline-none w-72"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}
          />
          <button className="px-6 py-3.5 rounded-2xl font-semibold text-sm transition"
            style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff" }}>
            Get early access →
          </button>
        </div>
        <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.3)" }}>No card. No spam. We'll reach out when spots open.</p>
      </section>

      {/* Floating post card */}
      <div className="max-w-4xl mx-auto px-10 pb-28">
        <div className="rounded-3xl p-8 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(196,181,253,0.05))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-3xl"
            style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }} />
          <div className="grid grid-cols-2 gap-8 items-center relative">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#a78bfa" }}>Generated in 4 seconds</p>
              <div className="rounded-2xl p-5 text-sm leading-relaxed"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}>
                <p className="font-bold mb-2 text-white">I built the wrong product for 3 years.</p>
                <p style={{ color: "rgba(255,255,255,0.65)" }}>Not because I didn't work hard. Because I never asked one question: "Who is this actually for?"</p>
                <p className="mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>Here's the conversation that changed everything…</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Audience", value: "👥 Peers" },
                { label: "Feeling", value: "💙 Vulnerable" },
                { label: "Resonance", value: "⚡ 84/100" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span className="font-semibold text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="px-10 py-24 max-w-4xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#a78bfa" }}>How it works</p>
        <h2 className="text-4xl font-black text-white mb-14" style={{ letterSpacing: "-1px" }}>Idea to post in 3 steps.</h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            { n: "1", t: "Type your thought", d: "Rough, messy, half-formed. Perfect." },
            { n: "2", t: "Set audience + feeling", d: "5 audiences. 5 feelings. Infinite combinations." },
            { n: "3", t: "Get your post", d: "Full post + short + carousel + hashtags." },
          ].map((s) => (
            <div key={s.n} className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-4xl font-black mb-4 block" style={{ color: "rgba(139,92,246,0.4)" }}>{s.n}</span>
              <p className="font-bold text-white mb-2">{s.t}</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-10 py-24" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#a78bfa" }}>Features</p>
          <h2 className="text-4xl font-black text-white mb-14" style={{ letterSpacing: "-1px" }}>Built around your voice.</h2>
          <div className="grid grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl transition"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-2xl mb-4 block">{f.emoji}</span>
                <p className="font-bold text-white mb-2">{f.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-10 py-28 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-5xl font-black text-white mb-4" style={{ letterSpacing: "-1.5px" }}>
            Your LinkedIn,<br />finally on brand.
          </h2>
          <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
            Join the waitlist. Early users get lifetime founder pricing.
          </p>
          <div className="flex items-center justify-center gap-4">
            <input type="email" placeholder="your@email.com" className="px-5 py-3.5 rounded-2xl text-sm focus:outline-none w-72"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }} />
            <button className="px-6 py-3.5 rounded-2xl font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff" }}>
              Join waitlist →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-10 flex items-center justify-between text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">B</span>
          </div>
          <span className="font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Brand OS</span>
        </div>
        <span>© 2025 Brand OS. All rights reserved.</span>
      </footer>
    </div>
  );
}
