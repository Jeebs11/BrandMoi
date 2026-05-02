import { useEffect, useRef } from "react";

export interface BackgroundEntry {
  key: string;
  label: string;
  category: "Minimal" | "Professional" | "Creative" | "Technical" | "Playful";
  component: React.ComponentType;
}

// ── Aurora ────────────────────────────────────────────────────────────────────
function Aurora() {
  return (
    <>
      <style>{`
        @keyframes aurora1 { 0%,100%{transform:translate(0%,0%) scale(1)} 50%{transform:translate(8%,6%) scale(1.15)} }
        @keyframes aurora2 { 0%,100%{transform:translate(0%,0%) scale(1)} 50%{transform:translate(-10%,-8%) scale(1.2)} }
        @keyframes aurora3 { 0%,100%{transform:translate(0%,0%) scale(1)} 60%{transform:translate(6%,-10%) scale(1.1)} }
      `}</style>
      <div style={{ position:"absolute",inset:0,background:"#0a0e1a",overflow:"hidden" }}>
        <div style={{ position:"absolute",width:"70%",height:"70%",top:"10%",left:"15%",background:"radial-gradient(ellipse,rgba(99,102,241,0.45) 0%,transparent 70%)",borderRadius:"50%",filter:"blur(48px)",animation:"aurora1 10s ease-in-out infinite" }} />
        <div style={{ position:"absolute",width:"60%",height:"60%",top:"30%",left:"30%",background:"radial-gradient(ellipse,rgba(139,92,246,0.35) 0%,transparent 70%)",borderRadius:"50%",filter:"blur(56px)",animation:"aurora2 13s ease-in-out infinite" }} />
        <div style={{ position:"absolute",width:"50%",height:"50%",top:"5%",left:"40%",background:"radial-gradient(ellipse,rgba(6,182,212,0.25) 0%,transparent 70%)",borderRadius:"50%",filter:"blur(40px)",animation:"aurora3 9s ease-in-out infinite" }} />
      </div>
    </>
  );
}

// ── Matrix ────────────────────────────────────────────────────────────────────
function Matrix() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";
    let cols: number[] = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const colCount = Math.floor(canvas.width / 14);
      cols = Array.from({ length: colCount }, () => Math.random() * -canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41";
      ctx.font = "13px monospace";
      cols.forEach((y, i) => {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillText(ch, i * 14, y);
        cols[i] = y > canvas.height + Math.random() * 80 ? Math.random() * -200 : y + 14;
      });
      raf = requestAnimationFrame(draw);
    };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%" }} />;
}

// ── Neural ────────────────────────────────────────────────────────────────────
function Neural() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface Node { x:number; y:number; vx:number; vy:number }
    const N = 40;
    let nodes: Node[] = [];
    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      nodes = Array.from({ length: N }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    };
    init();
    window.addEventListener("resize", init);
    const draw = () => {
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${(1 - dist/120) * 0.6})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#818cf8";
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); };
  }, []);
  return (
    <div style={{ position:"absolute",inset:0,background:"#0d1117" }}>
      <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%" }} />
    </div>
  );
}

// ── Particles ─────────────────────────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface Pt { x:number; y:number; r:number; vx:number; vy:number; a:number; va:number }
    let pts: Pt[] = [];
    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      pts = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        a: Math.random(),
        va: (Math.random() - 0.5) * 0.005,
      }));
    };
    init();
    window.addEventListener("resize", init);
    const draw = () => {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.a += p.va;
        if (p.a < 0.1) p.va = Math.abs(p.va);
        if (p.a > 0.9) p.va = -Math.abs(p.va);
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${p.a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#111827" }} />;
}

// ── Grid Pulse ────────────────────────────────────────────────────────────────
function GridPulse() {
  return (
    <>
      <style>{`
        @keyframes gpulse { 0%,100%{opacity:0.15} 50%{opacity:0.55} }
        .gp-dot { width:3px;height:3px;border-radius:50%;background:#6366f1;animation:gpulse var(--dur) ease-in-out infinite;animation-delay:var(--delay) }
      `}</style>
      <div style={{ position:"absolute",inset:0,background:"#0f172a",overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(99,102,241,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.08) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
        {Array.from({ length: 64 }, (_, i) => (
          <div key={i} className="gp-dot" style={{
            position:"absolute",
            left:`${(i % 8) * 12.5 + 6}%`,
            top:`${Math.floor(i / 8) * 12.5 + 6}%`,
            "--dur":`${2 + Math.random() * 3}s`,
            "--delay":`${Math.random() * 3}s`,
          } as React.CSSProperties} />
        ))}
      </div>
    </>
  );
}

// ── Constellation ─────────────────────────────────────────────────────────────
function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface Star { x:number; y:number; r:number; twinkle:number; tw:number }
    let stars: Star[] = [];
    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.5,
        twinkle: Math.random(),
        tw: (Math.random() - 0.5) * 0.02,
      }));
    };
    init();
    window.addEventListener("resize", init);
    const CONNECT_DIST = 90;
    const draw = () => {
      ctx.fillStyle = "#060b18";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.twinkle += s.tw;
        if (s.twinkle < 0.2) s.tw = Math.abs(s.tw);
        if (s.twinkle > 1) s.tw = -Math.abs(s.tw);
      });
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < CONNECT_DIST) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(148,163,184,${(1 - d/CONNECT_DIST) * 0.3})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }
      stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226,232,240,${s.twinkle})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#060b18" }} />;
}

// ── Topographic ───────────────────────────────────────────────────────────────
function Topographic() {
  return (
    <>
      <style>{`
        @keyframes topo-shift { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-120} }
        .topo-line { fill:none; stroke:rgba(99,102,241,0.25); stroke-width:1; stroke-dasharray:6 4; animation:topo-shift var(--spd) linear infinite; animation-delay:var(--dl) }
      `}</style>
      <div style={{ position:"absolute",inset:0,background:"#111827",overflow:"hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" style={{ position:"absolute",inset:0 }}>
          {[
            "M-20 80 Q80 40 180 90 T380 70 T520 80",
            "M-20 130 Q100 90 200 140 T400 120 T540 130",
            "M-20 190 Q70 150 170 200 T370 175 T510 190",
            "M-20 260 Q90 210 190 265 T390 240 T530 260",
            "M-20 340 Q110 290 210 350 T410 315 T550 340",
            "M-20 430 Q80 380 180 440 T380 400 T520 430",
            "M-20 530 Q100 475 200 540 T400 500 T540 530",
            "M-20 640 Q90 585 190 645 T390 605 T530 640",
            "M-20 760 Q110 700 210 765 T410 725 T550 760",
            "M30 20 Q130 -20 230 30 T430 10",
            "M-20 500 Q60 450 160 510 T360 470 T500 500",
            "M-20 390 Q95 335 195 395 T395 360 T535 390",
          ].map((d, i) => (
            <path key={i} d={d} className="topo-line" style={{ "--spd":`${18 + i * 2.5}s`, "--dl":`${-i * 1.5}s` } as React.CSSProperties} />
          ))}
        </svg>
      </div>
    </>
  );
}

// ── Ink Wash ──────────────────────────────────────────────────────────────────
function InkWash() {
  return (
    <>
      <style>{`
        @keyframes ink1 { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 33%{transform:translate(5%,8%) scale(1.1) rotate(5deg)} 66%{transform:translate(-4%,-6%) scale(0.95) rotate(-3deg)} }
        @keyframes ink2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-7%,5%) scale(1.12)} 80%{transform:translate(6%,-8%) scale(0.9)} }
        @keyframes ink3 { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 50%{transform:translate(4%,-6%) scale(1.08) rotate(-4deg)} }
      `}</style>
      <div style={{ position:"absolute",inset:0,background:"#f8f5f0",overflow:"hidden" }}>
        <div style={{ position:"absolute",width:"80%",height:"80%",top:"10%",left:"10%",background:"radial-gradient(ellipse,rgba(30,30,50,0.12) 0%,transparent 65%)",filter:"blur(60px)",animation:"ink1 16s ease-in-out infinite" }} />
        <div style={{ position:"absolute",width:"60%",height:"60%",top:"25%",left:"20%",background:"radial-gradient(ellipse,rgba(50,30,30,0.10) 0%,transparent 65%)",filter:"blur(50px)",animation:"ink2 20s ease-in-out infinite" }} />
        <div style={{ position:"absolute",width:"50%",height:"50%",top:"5%",left:"35%",background:"radial-gradient(ellipse,rgba(20,40,60,0.08) 0%,transparent 65%)",filter:"blur(40px)",animation:"ink3 12s ease-in-out infinite" }} />
      </div>
    </>
  );
}

// ── Neon Grid ─────────────────────────────────────────────────────────────────
function NeonGrid() {
  return (
    <>
      <style>{`
        @keyframes neon-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(200%)} }
        @keyframes neon-flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} 97%{opacity:0.8} 98%{opacity:1} }
      `}</style>
      <div style={{ position:"absolute",inset:0,background:"#05080f",overflow:"hidden",animation:"neon-flicker 6s linear infinite" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(0,255,180,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,180,0.07) 1px,transparent 1px),linear-gradient(rgba(0,255,180,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,180,0.03) 1px,transparent 1px)",backgroundSize:"80px 80px, 80px 80px, 20px 20px, 20px 20px" }} />
        <div style={{ position:"absolute",inset:"0 0",height:"30%",background:"linear-gradient(transparent,rgba(0,255,180,0.04),transparent)",animation:"neon-scan 8s linear infinite" }} />
        <div style={{ position:"absolute",bottom:"20%",left:"50%",transform:"translateX(-50%)",width:"40%",height:"3px",background:"rgba(0,255,180,0.4)",filter:"blur(8px)" }} />
      </div>
    </>
  );
}

// ── Wave ──────────────────────────────────────────────────────────────────────
function Wave() {
  return (
    <>
      <style>{`
        @keyframes wave1 { 0%{d:path("M0 60 Q100 20 200 60 T400 60 T600 60 L600 200 L0 200Z")} 50%{d:path("M0 60 Q100 100 200 60 T400 60 T600 60 L600 200 L0 200Z")} 100%{d:path("M0 60 Q100 20 200 60 T400 60 T600 60 L600 200 L0 200Z")} }
        @keyframes wave2 { 0%{d:path("M0 80 Q100 40 200 80 T400 80 T600 80 L600 200 L0 200Z")} 50%{d:path("M0 80 Q100 120 200 80 T400 80 T600 80 L600 200 L0 200Z")} 100%{d:path("M0 80 Q100 40 200 80 T400 80 T600 80 L600 200 L0 200Z")} }
      `}</style>
      <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)",overflow:"hidden" }}>
        <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" style={{ position:"absolute",bottom:0,width:"100%",height:"60%" }}>
          <path d="M0 80 Q150 20 300 80 T600 60 L600 200 L0 200Z" fill="rgba(6,182,212,0.15)">
            <animate attributeName="d" dur="7s" repeatCount="indefinite"
              values="M0 80 Q150 20 300 80 T600 60 L600 200 L0 200Z;M0 80 Q150 130 300 80 T600 100 L600 200 L0 200Z;M0 80 Q150 20 300 80 T600 60 L600 200 L0 200Z" />
          </path>
          <path d="M0 110 Q150 60 300 110 T600 90 L600 200 L0 200Z" fill="rgba(6,182,212,0.10)">
            <animate attributeName="d" dur="10s" repeatCount="indefinite"
              values="M0 110 Q150 60 300 110 T600 90 L600 200 L0 200Z;M0 110 Q150 155 300 110 T600 130 L600 200 L0 200Z;M0 110 Q150 60 300 110 T600 90 L600 200 L0 200Z" />
          </path>
          <path d="M0 140 Q150 100 300 140 T600 120 L600 200 L0 200Z" fill="rgba(14,116,144,0.2)">
            <animate attributeName="d" dur="13s" repeatCount="indefinite"
              values="M0 140 Q150 100 300 140 T600 120 L600 200 L0 200Z;M0 140 Q150 175 300 140 T600 155 L600 200 L0 200Z;M0 140 Q150 100 300 140 T600 120 L600 200 L0 200Z" />
          </path>
        </svg>
      </div>
    </>
  );
}

export const BACKGROUNDS: BackgroundEntry[] = [
  { key: "aurora",        label: "Aurora",        category: "Creative",      component: Aurora },
  { key: "matrix",        label: "Matrix",         category: "Technical",     component: Matrix },
  { key: "neural",        label: "Neural",         category: "Technical",     component: Neural },
  { key: "particles",     label: "Particles",      category: "Minimal",       component: Particles },
  { key: "grid-pulse",    label: "Grid Pulse",     category: "Professional",  component: GridPulse },
  { key: "constellation", label: "Constellation",  category: "Creative",      component: Constellation },
  { key: "topographic",   label: "Topographic",    category: "Professional",  component: Topographic },
  { key: "ink-wash",      label: "Ink Wash",       category: "Minimal",       component: InkWash },
  { key: "neon-grid",     label: "Neon Grid",      category: "Playful",       component: NeonGrid },
  { key: "wave",          label: "Ocean Wave",     category: "Playful",       component: Wave },
];

export function getBackground(key: string): BackgroundEntry | undefined {
  return BACKGROUNDS.find(b => b.key === key);
}
