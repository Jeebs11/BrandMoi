import "./landing.css";

const FEATURES = [
  {
    icon: "✦",
    title: "3 inputs. A post in seconds.",
    desc: "Your idea, your audience, your feeling. One tap and the AI shapes it into something worth posting.",
  },
  {
    icon: "◈",
    title: "Sounds like you, not LinkedIn.",
    desc: "Brand OS studies your voice DNA — sentence rhythm, vocabulary, opening style — and keeps it consistent across every post.",
  },
  {
    icon: "⟡",
    title: "Explore before you commit.",
    desc: "Stuck on which angle? Get 3 distinct directions — Direct, Vulnerable, Contrarian — in one fast call. Pick the one that feels right.",
  },
  {
    icon: "◎",
    title: "Learn what actually lands.",
    desc: "Log impressions, saves, reactions. Brand OS tracks which feeling and audience combo consistently wins for you — and nudges you before you generate.",
  },
];

const STEPS = [
  { n: "01", label: "Type a rough thought", sub: "No polish needed. A sentence, an opinion, a story seed." },
  { n: "02", label: "Pick audience + feeling", sub: "Clients, Peers, Investors. Direct, Vulnerable, Witty." },
  { n: "03", label: "Tap Make it", sub: "Post, short version, carousel, hashtags — all in one shot." },
];

export function VariantA() {
  return (
    <div className="lp-a min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">B</span>
          </div>
          <span className="font-extrabold text-gray-900 tracking-tight">Brand OS</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <a href="#how" className="hover:text-gray-900 transition">How it works</a>
          <a href="#features" className="hover:text-gray-900 transition">Features</a>
        </div>
        <button className="text-sm font-semibold bg-violet-600 text-white px-4 py-2 rounded-full hover:bg-violet-700 transition">
          Join waitlist
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-8 pt-24 pb-20">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-3 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse inline-block" />
          Now in private beta · Join the waitlist
        </div>
        <h1 className="text-[56px] font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
          Post on LinkedIn.<br />
          <span className="text-violet-600">Sound like yourself.</span>
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed max-w-xl mx-auto mb-10">
          Brand OS turns a rough thought into a post that sounds exactly like you — in seconds. No generic templates. No LinkedIn voice.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <input
            type="email"
            placeholder="your@email.com"
            className="w-72 px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400 bg-gray-50"
          />
          <button className="px-6 py-3 bg-violet-600 text-white font-semibold rounded-2xl hover:bg-violet-700 transition text-sm">
            Get early access →
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card. No spam. We'll email you when spots open.</p>
      </section>

      {/* App preview strip */}
      <div className="max-w-4xl mx-auto px-8 pb-24">
        <div className="bg-gray-900 rounded-3xl p-2 shadow-2xl shadow-violet-200/50">
          <div className="bg-white rounded-2xl overflow-hidden">
            {/* Fake app chrome */}
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4">
                <div className="w-48 h-5 rounded-full bg-gray-200 mx-auto" />
              </div>
            </div>
            {/* Fake capture screen */}
            <div className="px-8 py-6 max-w-sm mx-auto space-y-4">
              <p className="font-bold text-gray-900 text-sm">What do you want to say?</p>
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-gray-700 leading-relaxed">
                I spent 3 years building the wrong product. Nobody told me. Here's what I wish I'd known.
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Who's it for?</p>
                <div className="flex gap-2 flex-wrap">
                  {["🤝 Clients", "👥 Peers", "💼 Investors"].map((a, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${i === 1 ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600"}`}>{a}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">How should it feel?</p>
                <div className="flex gap-2 flex-wrap">
                  {["🎯 Direct", "💙 Vulnerable", "⚡ Contrarian"].map((f, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${i === 1 ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600"}`}>{f}</span>
                  ))}
                </div>
              </div>
              <button className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                ✦ Make it
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="bg-gray-50 py-24 px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-3">How it works</p>
          <h2 className="text-4xl font-black text-gray-900 mb-14">Three inputs. One great post.</h2>
          <div className="space-y-8">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-6 items-start">
                <span className="text-3xl font-black text-violet-200 shrink-0 w-12">{s.n}</span>
                <div>
                  <p className="font-bold text-gray-900 text-lg mb-1">{s.label}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-3">Features</p>
          <h2 className="text-4xl font-black text-gray-900 mb-14">Everything your LinkedIn presence needs.</h2>
          <div className="grid grid-cols-2 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition">
                <span className="text-2xl text-violet-400 mb-4 block">{f.icon}</span>
                <p className="font-bold text-gray-900 mb-2">{f.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-violet-600 py-24 px-8 text-center">
        <h2 className="text-4xl font-black text-white mb-4">Start building your LinkedIn presence.</h2>
        <p className="text-violet-200 mb-8 text-lg">Join the waitlist. We're opening spots soon.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <input type="email" placeholder="your@email.com" className="w-72 px-4 py-3 rounded-2xl text-sm focus:outline-none bg-white/10 border border-white/20 text-white placeholder-violet-300" />
          <button className="px-6 py-3 bg-white text-violet-700 font-semibold rounded-2xl hover:bg-violet-50 transition text-sm">
            Get early access →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-10 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center">
            <span className="text-white text-[9px] font-black">B</span>
          </div>
          <span className="font-bold text-gray-600">Brand OS</span>
        </div>
        <span>© 2025 Brand OS. All rights reserved.</span>
      </footer>
    </div>
  );
}
