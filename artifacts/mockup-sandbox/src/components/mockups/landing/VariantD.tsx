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
            <span className="font-semibold tracking-tight text-lg">Brand OS</span>
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
            Stop sounding like an AI generated your thoughts. Brand OS learns your voice DNA and turns raw ideas into posts that feel undeniably yours.
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

        {/* UI Demo Fragment */}
        <section className="max-w-6xl mx-auto px-6 mb-40 scroll-reveal opacity-0-init">
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-[#E5E5E5] shadow-2xl shadow-black/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#6056FA]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
            
            <div className="grid md:grid-cols-2 gap-16 items-center relative z-10">
              <div className="space-y-8">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-[#A3A3A3] mb-4">The Interface</h3>
                  <h2 className="text-3xl font-semibold text-[#1A1A1A] leading-tight">No templates. Just your ideas shaped into your voice.</h2>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-[#FAFAFA] p-6 rounded-2xl border border-[#E5E5E5]">
                    <p className="text-sm font-medium text-[#1A1A1A] mb-3">1. What's on your mind?</p>
                    <p className="text-[#666666] italic text-sm border-l-2 border-[#E5E5E5] pl-3">
                      "I spent 3 years building the wrong product. Nobody told me. Here's what I wish I'd known."
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1 bg-[#FAFAFA] p-4 rounded-2xl border border-[#E5E5E5]">
                      <p className="text-xs font-medium text-[#A3A3A3] mb-2 uppercase tracking-wide">Audience</p>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#1A1A1A]"></span>
                        <span className="text-sm font-medium text-[#1A1A1A]">Founders</span>
                      </div>
                    </div>
                    <div className="flex-1 bg-[#FAFAFA] p-4 rounded-2xl border border-[#E5E5E5]">
                      <p className="text-xs font-medium text-[#A3A3A3] mb-2 uppercase tracking-wide">Feeling</p>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#6056FA]"></span>
                        <span className="text-sm font-medium text-[#6056FA]">Vulnerable</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#6056FA]/10 to-transparent rounded-3xl -rotate-3 scale-105 border border-[#6056FA]/20"></div>
                <div className="bg-white rounded-2xl p-8 border border-[#E5E5E5] shadow-xl relative z-10 transform transition-transform duration-500 hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E5E5E5]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#E5E5E5]"></div>
                      <div>
                        <div className="h-3 w-24 bg-[#E5E5E5] rounded mb-1.5"></div>
                        <div className="h-2 w-16 bg-[#F5F5F5] rounded"></div>
                      </div>
                    </div>
                    <span className="text-[#6056FA] text-sm font-medium bg-[#E5E4FF] px-3 py-1 rounded-full">Draft generated</span>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[#1A1A1A] text-sm leading-relaxed">
                      I wasted three years building a product nobody wanted. And the worst part? Nobody told me.
                    </p>
                    <p className="text-[#1A1A1A] text-sm leading-relaxed">
                      My friends said "it looks great."<br/>
                      Investors said "keep going."<br/>
                      Users said... nothing. Because they weren't using it.
                    </p>
                    <p className="text-[#1A1A1A] text-sm leading-relaxed">
                      Here is the brutal truth about early-stage feedback that I learned the hard way.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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

        {/* The Engine */}
        <section className="py-32 px-6 scroll-reveal opacity-0-init">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-20 items-center">
            <div className="flex-1">
              <h2 className="text-4xl font-semibold text-[#1A1A1A] mb-6">It gets better every time you use it.</h2>
              <p className="text-[#666666] text-lg mb-8 leading-relaxed">
                Brand OS isn't just a prompt wrapper. It's a living model of your professional voice. Every post you approve, edit, or reject helps refine your Voice DNA profile.
              </p>
              <ul className="space-y-4">
                {[
                  "Analyzes your best-performing past content",
                  "Adapts to different audiences automatically",
                  "Remembers your favorite hooks and transitions",
                  "Suggests when to post based on momentum"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[#1A1A1A] font-medium">
                    <span className="text-[#6056FA]">✦</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full bg-[#FAFAFA] rounded-3xl p-8 border border-[#E5E5E5]">
               <div className="space-y-6">
                 <div>
                   <div className="flex justify-between text-sm mb-2"><span className="font-medium">Directness</span><span className="text-[#A3A3A3]">85%</span></div>
                   <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden"><div className="h-full bg-[#1A1A1A] w-[85%] rounded-full"></div></div>
                 </div>
                 <div>
                   <div className="flex justify-between text-sm mb-2"><span className="font-medium">Vulnerability</span><span className="text-[#A3A3A3]">60%</span></div>
                   <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden"><div className="h-full bg-[#6056FA] w-[60%] rounded-full"></div></div>
                 </div>
                 <div>
                   <div className="flex justify-between text-sm mb-2"><span className="font-medium">Academic</span><span className="text-[#A3A3A3]">15%</span></div>
                   <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden"><div className="h-full bg-[#A3A3A3] w-[15%] rounded-full"></div></div>
                 </div>
                 <div className="pt-4 border-t border-[#E5E5E5]">
                   <p className="text-xs text-[#A3A3A3] uppercase tracking-wider mb-3">Top Vocabulary</p>
                   <div className="flex flex-wrap gap-2">
                     <span className="px-3 py-1 bg-white border border-[#E5E5E5] rounded-md text-xs font-medium">actually</span>
                     <span className="px-3 py-1 bg-white border border-[#E5E5E5] rounded-md text-xs font-medium">brutal</span>
                     <span className="px-3 py-1 bg-white border border-[#E5E5E5] rounded-md text-xs font-medium">founder</span>
                     <span className="px-3 py-1 bg-white border border-[#E5E5E5] rounded-md text-xs font-medium">revenue</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="bg-[#6056FA] py-32 px-6 text-center scroll-reveal opacity-0-init">
          <div className="max-w-3xl mx-auto text-white">
            <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to find your voice?</h2>
            <p className="text-xl text-white/80 mb-12 font-light">Join the private beta. Spots are extremely limited as we train the early models.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
              <input 
                type="email" 
                placeholder="your@email.com" 
                className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-base text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 transition-colors"
              />
              <button className="w-full sm:w-auto bg-white text-[#6056FA] px-8 py-4 rounded-xl font-bold text-base hover:bg-[#FAFAFA] transition-all transform hover:-translate-y-0.5">
                Join Waitlist
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-sm text-[#A3A3A3] bg-[#FAFAFA] border-t border-[#E5E5E5]">
        <p>© 2025 Brand OS. Built for people who care.</p>
      </footer>
    </div>
  );
}
