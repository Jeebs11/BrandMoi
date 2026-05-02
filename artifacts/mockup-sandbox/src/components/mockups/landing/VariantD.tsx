import { useEffect, useRef } from "react";
import "./landing.css";

export function VariantD() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-fade-in-up");
          entry.target.classList.remove("opacity-0-init");
          observerRef.current?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll(".scroll-reveal").forEach(el => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="lp-d min-h-screen text-[#0F1F3D] selection:bg-[#0F1F3D] selection:text-white" style={{ background: "#F7F8FA" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b" style={{ background: "rgba(247,248,250,0.85)", borderColor: "#E2E6EC" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "#0F1F3D" }}>
              B
            </div>
            <span className="font-bold tracking-tight text-lg" style={{ color: "#0F1F3D" }}>BrandMe</span>
          </div>
          <button className="text-sm font-medium transition-colors duration-300" style={{ color: "#0F1F3D" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#2563EB")}
            onMouseLeave={e => (e.currentTarget.style.color = "#0F1F3D")}>
            Join Waitlist
          </button>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide mb-12 opacity-0-init animate-fade-in-up" style={{ background: "#E8EDF5", color: "#0F1F3D" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#2563EB" }}></span>
            Private Beta
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8 max-w-4xl mx-auto opacity-0-init animate-fade-in-up delay-100" style={{ color: "#0F1F3D", letterSpacing: "-2px" }}>
            Write for LinkedIn.<br/>
            <span className="font-light italic" style={{ color: "#8A97A8" }}>Sound like yourself.</span>
          </h1>
          
          <p className="text-xl md:text-2xl font-light max-w-2xl mx-auto leading-relaxed mb-12 opacity-0-init animate-fade-in-up delay-200" style={{ color: "#4A5568" }}>
            Stop sounding like an AI generated your thoughts. BrandMe learns your voice DNA and turns raw ideas into posts that feel undeniably yours.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0-init animate-fade-in-up delay-300">
            <div className="relative w-full sm:w-80">
              <input 
                type="email" 
                placeholder="Drop your email..." 
                className="w-full rounded-xl px-5 py-4 text-base focus:outline-none transition-all shadow-sm"
                style={{ background: "#fff", border: "1px solid #D1D9E6", color: "#0F1F3D" }}
              />
            </div>
            <button className="w-full sm:w-auto text-white px-8 py-4 rounded-xl font-semibold text-base transition-all duration-300 shadow-md"
              style={{ background: "#0F1F3D" }}>
              Request Access
            </button>
          </div>
          <p className="text-xs mt-4" style={{ color: "#8A97A8" }}>No credit card. No spam.</p>
        </section>

        {/* Philosophy Section */}
        <section className="text-white py-32 px-6 scroll-reveal opacity-0-init" style={{ background: "#0F1F3D" }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-semibold mb-8 leading-tight">
              Generic content destroys trust.<br/>
              <span className="font-light italic" style={{ color: "#4A6080" }}>Authenticity builds it.</span>
            </h2>
            <p className="text-xl font-light max-w-2xl mx-auto leading-relaxed mb-16" style={{ color: "#7A90A8" }}>
              Most AI tools make you sound like a robot reading a marketing textbook. We built an engine that studies your sentence rhythm, vocabulary, and cadence to write exactly how you speak.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { title: "No 'Elevate' or 'Delve'", desc: "We banned the typical AI vocabulary. No more fluffy corporate speak." },
                { title: "Your Rhythm", desc: "Short sentences? Long paragraphs? The engine mirrors your natural pacing." },
                { title: "Opinionated", desc: "It doesn't water down your takes. It makes them sharper and clearer." }
              ].map((feature, i) => (
                <div key={i} className="pt-6" style={{ borderTop: "1px solid #1E3358" }}>
                  <h4 className="text-lg font-semibold mb-3">{feature.title}</h4>
                  <p className="text-sm leading-relaxed" style={{ color: "#7A90A8" }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="py-8 text-center text-sm border-t" style={{ color: "#8A97A8", background: "#F7F8FA", borderColor: "#E2E6EC" }}>
        <p>© 2025 BrandMe. Built for people who care.</p>
      </footer>
    </div>
  );
}
