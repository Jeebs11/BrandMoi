import "./landing.css";

export function VariantC() {
  return (
    <div className="lp-c min-h-screen font-sans bg-[#fafaf9]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-5 bg-white border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">B</span>
          </div>
          <span className="font-extrabold text-stone-900 tracking-tight">Brand OS</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-stone-400">
          <a href="#how" className="hover:text-stone-800 transition">How it works</a>
          <a href="#features" className="hover:text-stone-800 transition">Features</a>
        </div>
        <button className="text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-4 py-2 rounded-full hover:bg-violet-100 transition">
          Join waitlist
        </button>
      </nav>

      {/* Hero — editorial, full-bleed gradient strip */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(160deg, #ede9fe 0%, #fafaf9 50%)" }} />
        <div className="relative max-w-5xl mx-auto px-10 pt-24 pb-20 grid grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-violet-600 bg-white border border-violet-200 rounded-full px-3 py-1.5 mb-8 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
              Private beta — join now
            </div>
            <h1 className="text-5xl font-black text-stone-900 leading-[1.1] tracking-tight mb-5" style={{ letterSpacing: "-1.5px" }}>
              Write LinkedIn posts<br />
              <em className="not-italic text-violet-600">that sound like you.</em>
            </h1>
            <p className="text-lg text-stone-500 leading-relaxed mb-8">
              Not a template filler. Not a prompt wrapper. Brand OS learns your voice and uses it every time.
            </p>
            <div className="flex items-center gap-3">
              <input type="email" placeholder="you@company.com"
                className="flex-1 px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:border-violet-400 bg-white" />
              <button className="px-5 py-3 bg-violet-600 text-white font-semibold rounded-2xl hover:bg-violet-700 transition text-sm whitespace-nowrap">
                Get access →
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-3">Free during beta. No card required.</p>
          </div>

          {/* Floating UI mockup */}
          <div className="relative">
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-violet-100 blur-2xl opacity-60" />
            <div className="relative bg-white rounded-3xl shadow-xl shadow-violet-100/50 p-6 border border-stone-100">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">What do you want to say?</p>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-stone-700 leading-relaxed mb-4">
                I spent 3 years building the wrong product. Nobody told me.
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-600 text-white">👥 Peers</span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-stone-200 text-stone-500">🤝 Clients</span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-stone-200 text-stone-500">💼 Investors</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-600 text-white">💙 Vulnerable</span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-stone-200 text-stone-500">⚡ Contrarian</span>
              </div>
              {/* Performance nudge */}
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-violet-50 border border-violet-100">
                <span className="text-xs">✦</span>
                <p className="text-xs text-violet-700 font-medium">Vulnerable posts resonate most for you</p>
              </div>
              <button className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-bold">
                ✦ Make it
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <div className="bg-white border-y border-stone-100 py-5 px-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-xs text-stone-400 font-medium">Trusted by people who care about their LinkedIn presence</p>
          <div className="flex items-center gap-6">
            {["Founders", "Operators", "Consultants", "Creators", "Recruiters"].map((t) => (
              <span key={t} className="text-xs font-semibold text-stone-500">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="py-24 px-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-3">How it works</p>
            <h2 className="text-4xl font-black text-stone-900 mb-8" style={{ letterSpacing: "-1px" }}>
              Three steps.<br />One voice.
            </h2>
            <div className="space-y-6">
              {[
                { n: "1", t: "Drop your rough thought", d: "No polish needed — a sentence, a story seed, a half-formed opinion." },
                { n: "2", t: "Set audience + feeling", d: "Clients, Peers, or Investors. Direct, Vulnerable, Contrarian, or more." },
                { n: "3", t: "Get your post", d: "Full post, short version, carousel outline, and hashtags — one shot." },
              ].map((s) => (
                <div key={s.n} className="flex gap-5">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm font-black shrink-0 mt-0.5">
                    {s.n}
                  </div>
                  <div>
                    <p className="font-bold text-stone-900 mb-1">{s.t}</p>
                    <p className="text-sm text-stone-500 leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Right: explore directions card */}
          <div className="bg-white border border-stone-100 rounded-3xl p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Explore 3 angles</p>
            <div className="space-y-3">
              {[
                { feeling: "Contrarian", hook: "Everyone says ship fast. Here's when that's exactly wrong.", pts: ["PMF takes longer than iteration cycles", "Speed kills positioning", "Pausing is a valid strategy"] },
                { feeling: "Story", hook: "Year 3. The product worked. Our customers had stopped using it.", pts: ["The slow leak nobody talked about", "What the data was hiding", "The conversation that changed it"] },
                { feeling: "Direct", hook: "3 questions I ask every founder before they write another line of code.", pts: ["Who is suffering without this?", "Will they pay now?", "Who else wants to solve this?"] },
              ].map((d, i) => (
                <div key={i} className={`p-4 rounded-xl border text-sm ${i === 1 ? "border-violet-300 bg-violet-50" : "border-stone-100"}`}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 ${i === 1 ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-500"}`}>{d.feeling}</span>
                  <p className={`font-semibold mt-2 mb-1.5 ${i === 1 ? "text-violet-900" : "text-stone-800"}`}>"{d.hook}"</p>
                  <ul className="text-xs text-stone-400 space-y-0.5">
                    {d.pts.map((p, j) => <li key={j}>· {p}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-24 px-10 bg-white border-t border-stone-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-3">Features</p>
          <h2 className="text-4xl font-black text-stone-900 mb-14" style={{ letterSpacing: "-1px" }}>Built around your voice.</h2>
          <div className="grid grid-cols-2 gap-6">
            {[
              { icon: "🎙", t: "Voice DNA", d: "Learns your sentence rhythm, vocabulary, and opening style from posts you write. Every new post sounds like you — not like a chatbot that read your bio." },
              { icon: "⚡", t: "Explore 3 angles", d: "Before you commit to a full post, see three distinct directions — a hook, three supporting ideas — for Direct, Story, and Contrarian takes on the same thought." },
              { icon: "📊", t: "Performance nudge", d: "Brand OS reads your resonance history and shows a gentle nudge — \"Vulnerable works best for you\" — right next to the feeling selector." },
              { icon: "🔁", t: "More like this", d: "Spot a top post in your Library? One tap pre-loads Capture with the same audience, feeling, and hook pattern to replicate what already works." },
            ].map((f) => (
              <div key={f.t} className="p-6 rounded-2xl border border-stone-100 hover:border-violet-200 transition">
                <span className="text-2xl mb-4 block">{f.icon}</span>
                <p className="font-bold text-stone-900 mb-2">{f.t}</p>
                <p className="text-sm text-stone-500 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-10 text-center" style={{ background: "linear-gradient(160deg, #ede9fe, #fafaf9)" }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-4">Join the waitlist</p>
          <h2 className="text-5xl font-black text-stone-900 mb-4" style={{ letterSpacing: "-1.5px" }}>
            Your voice.<br />Your brand.
          </h2>
          <p className="text-lg text-stone-500 mb-10">
            We're opening early access soon. Be first in line.
          </p>
          <div className="flex items-center justify-center gap-3">
            <input type="email" placeholder="you@company.com"
              className="px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:border-violet-400 bg-white w-64" />
            <button className="px-6 py-3 bg-violet-600 text-white font-semibold rounded-2xl hover:bg-violet-700 transition text-sm">
              Get early access →
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-3">No credit card. No spam.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-10 border-t border-stone-100 bg-white flex items-center justify-between text-xs text-stone-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">B</span>
          </div>
          <span className="font-bold text-stone-600">Brand OS</span>
        </div>
        <span>© 2025 Brand OS. All rights reserved.</span>
      </footer>
    </div>
  );
}
