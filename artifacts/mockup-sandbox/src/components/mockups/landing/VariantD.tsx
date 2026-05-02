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
    <div className="lp-d min-h-screen bg-[#FAFAFA] text-[#1A1A1A] selection:bg-[#6056FA] selection:text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-[#E5E5E5]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-bold text-sm">
              B
            </div>
            <span className="font-semibold tracking-tight text-lg">BrandMe</span>
          </div>
          <button className="text-sm font-medium hover:text-[#6056FA] transition-colors duration-300">
            Join Waitlist
          </button>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5E4FF] text-[#6056FA] text-xs font-semibold tracking-wide mb-12 opacity-0-init animate-fade-in-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6056FA] animate-pulse"></span>
            Private Beta
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#1A1A1A] leading-[1.1] mb-8 max-w-4xl mx-auto opacity-0-init animate-fade-in-up delay-100">
            Write for LinkedIn.<br/>
            <span className="text-[#A3A3A3] font-light italic">Sound like yourself.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-[#666666] font-light max-w-2xl mx-auto leading-relaxed mb-12 opacity-0-init animate-fade-in-up delay-200">
            Stop sounding like an AI generated your thoughts. BrandMe learns your voice DNA and turns raw ideas into posts that feel undeniably yours.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0-init animate-fade-in-up delay-300">
            <div className="relative w-full sm:w-80">
              <input 
                type="email" 
                placeholder="Drop your email..." 
                className="w-full bg-white border border-[#E5E5E5] rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-[#6056FA]/20 focus:border-[#6056FA] transition-all shadow-sm"
              />
            </div>
            <button className="w-full sm:w-auto bg-[#1A1A1A] text-white px-8 py-4 rounded-xl font-medium text-base hover:bg-[#6056FA] transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-[#6056FA]/20 transform hover:-translate-y-0.5">
              Request Access
            </button>
          </div>
        </section>

        {/* Philosophy Section */}
        <section className="bg-[#1A1A1A] text-white py-32 px-6 scroll-reveal opacity-0-init">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-semibold mb-8 leading-tight">
              Generic content destroys trust.<br/>
              <span className="text-[#666666] italic">Authenticity builds it.</span>
            </h2>
            <p className="text-xl text-[#A3A3A3] font-light max-w-2xl mx-auto leading-relaxed mb-16">
              Most AI tools make you sound like a robot reading a marketing textbook. We built an engine that studies your sentence rhythm, vocabulary, and cadence to write exactly how you speak.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { title: "No 'Elevate' or 'Delve'", desc: "We banned the typical AI vocabulary. No more fluffy corporate speak." },
                { title: "Your Rhythm", desc: "Short sentences? Long paragraphs? The engine mirrors your natural pacing." },
                { title: "Opinionated", desc: "It doesn't water down your takes. It makes them sharper and clearer." }
              ].map((feature, i) => (
                <div key={i} className="border-t border-[#333333] pt-6">
                  <h4 className="text-lg font-medium mb-3">{feature.title}</h4>
                  <p className="text-[#A3A3A3] text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="py-8 text-center text-sm text-[#A3A3A3] bg-[#FAFAFA] border-t border-[#E5E5E5]">
        <p>© 2025 BrandMe. Built for people who care.</p>
      </footer>
    </div>
  );
}
