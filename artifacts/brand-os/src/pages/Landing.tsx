import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "@/landing.css";

export default function Landing() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-animate-in");
            entry.target.classList.remove("lp-hidden");
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".lp-scroll-reveal").forEach((el) => {
      observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    const params = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    navigate(`/signup${params}`);
  };

  const scrollToEmail = () => {
    emailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => emailRef.current?.focus(), 500);
  };

  return (
    <div className="min-h-screen text-[#0F1F3D] selection:bg-[#0F1F3D] selection:text-white" style={{ background: "#F7F8FA", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b" style={{ background: "rgba(247,248,250,0.85)", borderColor: "#E2E6EC" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm" style={{ background: "#0F1F3D" }}>B</div>
            <span className="tracking-tight text-lg">
              <span style={{ fontWeight: 800, color: "#0F1F3D" }}>Brand</span>
              <span style={{ fontWeight: 300, color: "#0F1F3D", opacity: 0.45 }}>Me</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium transition-colors duration-300"
              style={{ color: "#8A97A8" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#0F1F3D")}
              onMouseLeave={e => (e.currentTarget.style.color = "#8A97A8")}
            >
              Log in
            </button>
            <button
              onClick={scrollToEmail}
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-300"
              style={{ background: "#0F1F3D", color: "#fff" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24">

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8 max-w-4xl mx-auto lp-hidden lp-animate-in lp-delay-100"
            style={{ color: "#0F1F3D", letterSpacing: "-2px" }}
          >
            Write for <span style={{ color: "#0A66C2" }}>LinkedIn</span>.<br />
            <span className="font-light italic" style={{ color: "#8A97A8" }}>Sound like yourself.</span>
          </h1>

          <p
            className="text-xl md:text-2xl font-light max-w-2xl mx-auto leading-relaxed mb-12 lp-hidden lp-animate-in lp-delay-200"
            style={{ color: "#4A5568" }}
          >
            Stop sounding like an AI generated your thoughts. BrandMe learns your voice DNA and turns raw ideas into posts that feel undeniably yours.
          </p>

          <form
            onSubmit={handleRequestAccess}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 lp-hidden lp-animate-in lp-delay-300"
          >
            <div className="relative w-full sm:w-80">
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Drop your email..."
                className="w-full rounded-xl px-5 py-4 text-base focus:outline-none transition-all shadow-sm"
                style={{ background: "#fff", border: "1px solid #D1D9E6", color: "#0F1F3D" }}
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto text-white px-8 py-4 rounded-xl font-semibold text-base transition-all duration-300 shadow-md"
              style={{ background: "#0F1F3D" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Request Access
            </button>
          </form>
        </section>

        {/* Philosophy */}
        <section
          className="text-white py-32 px-6 lp-scroll-reveal lp-hidden"
          style={{ background: "#0F1F3D" }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-semibold mb-8 leading-tight">
              Generic content destroys trust.<br />
              <span className="font-light italic" style={{ color: "#4A6080" }}>Authenticity builds it.</span>
            </h2>
            <p className="text-xl font-light max-w-2xl mx-auto leading-relaxed mb-16" style={{ color: "#7A90A8" }}>
              Most AI tools make you sound like a robot reading a marketing textbook. We built an engine that studies your sentence rhythm, vocabulary, and cadence to write exactly how you speak.
            </p>

            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { title: "No 'Elevate' or 'Delve'", desc: "We banned the typical AI vocabulary. No more fluffy corporate speak." },
                { title: "Your Rhythm", desc: "Short sentences? Long paragraphs? The engine mirrors your natural pacing." },
                { title: "Opinionated", desc: "It doesn't water down your takes. It makes them sharper and clearer." },
              ].map((f, i) => (
                <div key={i} className="pt-6" style={{ borderTop: "1px solid #1E3358" }}>
                  <h4 className="text-lg font-semibold mb-3">{f.title}</h4>
                  <p className="text-sm leading-relaxed" style={{ color: "#7A90A8" }}>{f.desc}</p>
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
