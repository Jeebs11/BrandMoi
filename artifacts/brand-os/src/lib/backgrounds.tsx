import { useEffect, useRef } from "react";
import { useBackgroundTheme, SPEED_MULT, DENSITY_MULT } from "@/lib/background-context";

export interface BackgroundEntry {
  key: string;
  label: string;
  category: "Minimal" | "Professional" | "Creative" | "Technical" | "Playful";
  component: React.ComponentType;
  interactive?: boolean;
}

// ── Shared helper: window-level mouse tracker ─────────────────────────────────
// All interactive canvas backgrounds use this so they receive events
// regardless of pointer-events:none on the container.
function useWindowMouse(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = null; };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [canvasRef]);
  return mouseRef;
}

// ── Aurora ────────────────────────────────────────────────────────────────────
function Aurora() {
  const { speed } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  return (
    <div style={{ position:"absolute",inset:0,background:"#0a0e1a",overflow:"hidden" }}>
      <style>{`
        @keyframes aurora1 { 0%,100%{transform:translate(0%,0%) scale(1)} 50%{transform:translate(8%,6%) scale(1.15)} }
        @keyframes aurora2 { 0%,100%{transform:translate(0%,0%) scale(1)} 50%{transform:translate(-10%,-8%) scale(1.2)} }
        @keyframes aurora3 { 0%,100%{transform:translate(0%,0%) scale(1)} 60%{transform:translate(6%,-10%) scale(1.1)} }
      `}</style>
      <div style={{ position:"absolute",width:"70%",height:"70%",top:"10%",left:"15%",background:"radial-gradient(ellipse,rgba(99,102,241,0.45) 0%,transparent 70%)",borderRadius:"50%",filter:"blur(48px)",animation:`aurora1 ${10/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"60%",height:"60%",top:"30%",left:"30%",background:"radial-gradient(ellipse,rgba(139,92,246,0.35) 0%,transparent 70%)",borderRadius:"50%",filter:"blur(56px)",animation:`aurora2 ${13/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"50%",height:"50%",top:"5%",left:"40%",background:"radial-gradient(ellipse,rgba(6,182,212,0.25) 0%,transparent 70%)",borderRadius:"50%",filter:"blur(40px)",animation:`aurora3 ${9/m}s ease-in-out infinite` }} />
    </div>
  );
}

// ── Matrix (interactive: column under cursor brightens & speeds up) ───────────
function Matrix() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";
    let cols: number[] = [];
    const COL_W = density === "high" ? 9 : density === "low" ? 22 : 14;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      cols = Array.from({ length: Math.floor(canvas.width / COL_W) }, () => Math.random() * -canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const sp = speedRef.current;
      const mouse = mouseRef.current;
      const hotCol = mouse !== null ? Math.floor(mouse.x / COL_W) : null;

      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "13px monospace";

      cols.forEach((y, i) => {
        const hot = hotCol !== null && Math.abs(i - hotCol) <= 1;
        ctx.fillStyle = hot ? "#ffffff" : (Math.random() > 0.02 ? "#00ff41" : "#88ffaa");
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, y);
        const step = COL_W * Math.max(0.15, sp) * (hot ? 2.5 : 1);
        cols[i] = y > canvas.height + Math.random() * 80 ? Math.random() * -200 : y + step;
      });
      raf = requestAnimationFrame(draw);
    };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#000" }} />;
}

// ── Neural (interactive: nodes drift toward cursor, click = burst) ─────────────
function Neural() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface Node { x:number; y:number; vx:number; vy:number }
    let nodes: Node[] = [];

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      nodes = Array.from({ length: Math.round(40 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }));
    };
    init();
    window.addEventListener("resize", init);

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      nodes.forEach(n => {
        const dx = n.x - px, dy = n.y - py;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        if (d < 160) { const f = (160 - d) / 160 * 3; n.vx += (dx/d)*f; n.vy += (dy/d)*f; }
      });
    };
    window.addEventListener("click", onClick);

    const draw = () => {
      const sp = speedRef.current;
      const mouse = mouseRef.current;
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach(n => {
        if (mouse) {
          const dx = mouse.x - n.x, dy = mouse.y - n.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          if (d < 200) { const f = (200-d)/200 * 0.10; n.vx += (dx/d)*f; n.vy += (dy/d)*f; }
        }
        n.vx = Math.max(-3, Math.min(3, n.vx * 0.98));
        n.vy = Math.max(-3, Math.min(3, n.vy * 0.98));
        n.x += n.vx * sp; n.y += n.vy * sp;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        n.x = Math.max(0, Math.min(canvas.width, n.x));
        n.y = Math.max(0, Math.min(canvas.height, n.y));
      });

      for (let i = 0; i < nodes.length; i++) for (let j = i+1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 120) {
          ctx.beginPath(); ctx.strokeStyle = `rgba(99,102,241,${(1-d/120)*0.6})`; ctx.lineWidth = 0.8;
          ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
        }
      }

      if (mouse) {
        nodes.forEach(n => {
          const dx = mouse.x - n.x, dy = mouse.y - n.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < 160) {
            ctx.beginPath(); ctx.strokeStyle = `rgba(129,140,248,${(1-d/160)*0.4})`; ctx.lineWidth = 0.6;
            ctx.moveTo(n.x, n.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        });
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI*2);
        ctx.fillStyle = "rgba(129,140,248,0.9)"; ctx.fill();
      }

      nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x, n.y, 2.5, 0, Math.PI*2);
        ctx.fillStyle = "#818cf8"; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
      window.removeEventListener("click", onClick);
    };
  }, [mouseRef, density]);

  return (
    <div style={{ position:"absolute",inset:0,background:"#0d1117" }}>
      <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%" }} />
    </div>
  );
}

// ── Particles (interactive: drift toward cursor, click = scatter) ──────────────
function Particles() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

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
      pts = Array.from({ length: Math.round(90 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        a: Math.random() * 0.7 + 0.2,
        va: (Math.random() - 0.5) * 0.005,
      }));
    };
    init();
    window.addEventListener("resize", init);

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      pts.forEach(p => {
        const dx = p.x - px, dy = p.y - py;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        if (d < 140) { const f = (140-d)/140 * 2.5; p.vx += (dx/d)*f; p.vy += (dy/d)*f; }
      });
    };
    window.addEventListener("click", onClick);

    const draw = () => {
      const sp = speedRef.current;
      const mouse = mouseRef.current;
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      pts.forEach(p => {
        if (mouse) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          if (d < 180) { const f = (180-d)/180 * 0.035; p.vx += (dx/d)*f; p.vy += (dy/d)*f; }
        }
        p.vx = Math.max(-2.5, Math.min(2.5, p.vx * 0.99));
        p.vy = Math.max(-2.5, Math.min(2.5, p.vy * 0.99));
        p.x += p.vx * sp; p.y += p.vy * sp;
        p.a += p.va * sp;
        if (p.a < 0.1) p.va = Math.abs(p.va);
        if (p.a > 0.95) p.va = -Math.abs(p.va);
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(148,163,184,${p.a})`; ctx.fill();
      });

      if (mouse) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 70);
        g.addColorStop(0, "rgba(148,163,184,0.18)"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 70, 0, Math.PI*2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
      window.removeEventListener("click", onClick);
    };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#111827" }} />;
}

// ── Grid Pulse ────────────────────────────────────────────────────────────────
function GridPulse() {
  const { speed, density } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  const COLS = density === "high" ? 10 : density === "low" ? 6 : 8;
  const total = COLS * COLS;
  const step = 100 / COLS;
  return (
    <div style={{ position:"absolute",inset:0,background:"#0f172a",overflow:"hidden" }}>
      <style>{`@keyframes gpulse { 0%,100%{opacity:0.12} 50%{opacity:0.6} }`}</style>
      <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(99,102,241,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.08) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          position:"absolute",
          left:`${(i % COLS) * step + step * 0.5}%`,
          top:`${Math.floor(i / COLS) * step + step * 0.5}%`,
          width:3,height:3,borderRadius:"50%",background:"#6366f1",
          animation:`gpulse ${(2 + (i*0.11)%3)/m}s ease-in-out ${-(i*0.07)%3}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Constellation (interactive: cursor = bright star + connections) ────────────
function Constellation() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

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
      stars = Array.from({ length: Math.round(140 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.4,
        twinkle: Math.random(),
        tw: (Math.random() - 0.5) * 0.02,
      }));
    };
    init();
    window.addEventListener("resize", init);

    const draw = () => {
      const sp = Math.max(0.3, speedRef.current);
      const mouse = mouseRef.current;
      ctx.fillStyle = "#060b18";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach(s => {
        s.twinkle += s.tw * sp;
        if (s.twinkle < 0.2) s.tw = Math.abs(s.tw);
        if (s.twinkle > 1) s.tw = -Math.abs(s.tw);
      });

      for (let i = 0; i < stars.length; i++) for (let j = i+1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 90) {
          ctx.beginPath(); ctx.strokeStyle = `rgba(148,163,184,${(1-d/90)*0.28})`; ctx.lineWidth = 0.5;
          ctx.moveTo(stars[i].x, stars[i].y); ctx.lineTo(stars[j].x, stars[j].y); ctx.stroke();
        }
      }

      if (mouse) {
        stars.forEach(s => {
          const dx = mouse.x - s.x, dy = mouse.y - s.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < 140) {
            ctx.beginPath(); ctx.strokeStyle = `rgba(220,232,255,${(1-d/140)*0.55})`; ctx.lineWidth = 0.8;
            ctx.moveTo(s.x, s.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        });
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 3.5, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill();
        const halo = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 14);
        halo.addColorStop(0, "rgba(255,255,255,0.15)"); halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 14, 0, Math.PI*2); ctx.fill();
      }

      stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(226,232,240,${s.twinkle})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#060b18" }} />;
}

// ── Topographic ───────────────────────────────────────────────────────────────
function Topographic() {
  const { speed } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  return (
    <div style={{ position:"absolute",inset:0,background:"#111827",overflow:"hidden" }}>
      <style>{`@keyframes topo-shift { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-120} }`}</style>
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
          <path key={i} d={d} fill="none" stroke="rgba(99,102,241,0.25)" strokeWidth={1} strokeDasharray="6 4"
            style={{ animation:`topo-shift ${(18+i*2.5)/m}s linear ${-i*1.5}s infinite` }} />
        ))}
      </svg>
    </div>
  );
}

// ── Ink Wash ──────────────────────────────────────────────────────────────────
function InkWash() {
  const { speed } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  return (
    <div style={{ position:"absolute",inset:0,background:"#f8f5f0",overflow:"hidden" }}>
      <style>{`
        @keyframes ink1 { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 33%{transform:translate(5%,8%) scale(1.1) rotate(5deg)} 66%{transform:translate(-4%,-6%) scale(0.95) rotate(-3deg)} }
        @keyframes ink2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-7%,5%) scale(1.12)} 80%{transform:translate(6%,-8%) scale(0.9)} }
        @keyframes ink3 { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 50%{transform:translate(4%,-6%) scale(1.08) rotate(-4deg)} }
      `}</style>
      <div style={{ position:"absolute",width:"80%",height:"80%",top:"10%",left:"10%",background:"radial-gradient(ellipse,rgba(30,30,50,0.12) 0%,transparent 65%)",filter:"blur(60px)",animation:`ink1 ${16/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"60%",height:"60%",top:"25%",left:"20%",background:"radial-gradient(ellipse,rgba(50,30,30,0.10) 0%,transparent 65%)",filter:"blur(50px)",animation:`ink2 ${20/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"50%",height:"50%",top:"5%",left:"35%",background:"radial-gradient(ellipse,rgba(20,40,60,0.08) 0%,transparent 65%)",filter:"blur(40px)",animation:`ink3 ${12/m}s ease-in-out infinite` }} />
    </div>
  );
}

// ── Neon Grid ─────────────────────────────────────────────────────────────────
function NeonGrid() {
  const { speed } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  return (
    <div style={{ position:"absolute",inset:0,background:"#05080f",overflow:"hidden" }}>
      <style>{`
        @keyframes neon-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(200%)} }
        @keyframes neon-flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.6} 94%{opacity:1} 97%{opacity:0.8} 98%{opacity:1} }
      `}</style>
      <div style={{ position:"absolute",inset:0,animation:"neon-flicker 6s linear infinite" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(0,255,180,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,180,0.07) 1px,transparent 1px),linear-gradient(rgba(0,255,180,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,180,0.03) 1px,transparent 1px)",backgroundSize:"80px 80px, 80px 80px, 20px 20px, 20px 20px" }} />
        <div style={{ position:"absolute",inset:0,height:"30%",background:"linear-gradient(transparent,rgba(0,255,180,0.04),transparent)",animation:`neon-scan ${8/m}s linear infinite` }} />
        <div style={{ position:"absolute",bottom:"20%",left:"50%",transform:"translateX(-50%)",width:"40%",height:"3px",background:"rgba(0,255,180,0.4)",filter:"blur(8px)" }} />
      </div>
    </div>
  );
}

// ── Wave ──────────────────────────────────────────────────────────────────────
function Wave() {
  const { speed } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  return (
    <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,#0f2027 0%,#203a43 50%,#2c5364 100%)",overflow:"hidden" }}>
      <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" style={{ position:"absolute",bottom:0,width:"100%",height:"60%" }}>
        <path d="M0 80 Q150 20 300 80 T600 60 L600 200 L0 200Z" fill="rgba(6,182,212,0.15)">
          <animate attributeName="d" dur={`${7/m}s`} repeatCount="indefinite"
            values="M0 80 Q150 20 300 80 T600 60 L600 200 L0 200Z;M0 80 Q150 130 300 80 T600 100 L600 200 L0 200Z;M0 80 Q150 20 300 80 T600 60 L600 200 L0 200Z" />
        </path>
        <path d="M0 110 Q150 60 300 110 T600 90 L600 200 L0 200Z" fill="rgba(6,182,212,0.10)">
          <animate attributeName="d" dur={`${10/m}s`} repeatCount="indefinite"
            values="M0 110 Q150 60 300 110 T600 90 L600 200 L0 200Z;M0 110 Q150 155 300 110 T600 130 L600 200 L0 200Z;M0 110 Q150 60 300 110 T600 90 L600 200 L0 200Z" />
        </path>
        <path d="M0 140 Q150 100 300 140 T600 120 L600 200 L0 200Z" fill="rgba(14,116,144,0.2)">
          <animate attributeName="d" dur={`${13/m}s`} repeatCount="indefinite"
            values="M0 140 Q150 100 300 140 T600 120 L600 200 L0 200Z;M0 140 Q150 175 300 140 T600 155 L600 200 L0 200Z;M0 140 Q150 100 300 140 T600 120 L600 200 L0 200Z" />
        </path>
      </svg>
    </div>
  );
}

// ── Fireflies (interactive: warm glowing orbs drift & pulse, scatter on hover) ──
function Fireflies() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface Fly { x:number; y:number; vx:number; vy:number; phase:number; dPhase:number; r:number; hue:number }
    let flies: Fly[] = [];

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      flies = Array.from({ length: Math.round(52 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        dPhase: 0.01 + Math.random() * 0.022,
        r: 1.3 + Math.random() * 1.8,
        hue: 42 + Math.random() * 55,
      }));
    };
    init();
    window.addEventListener("resize", init);

    const draw = () => {
      const sp = speedRef.current;
      const mouse = mouseRef.current;
      ctx.fillStyle = "rgba(4,8,3,0.87)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      flies.forEach(f => {
        f.phase += f.dPhase * sp;
        const glow = (Math.sin(f.phase) + 1) / 2;

        f.vx += (Math.random() - 0.5) * 0.01;
        f.vy += (Math.random() - 0.5) * 0.01 - 0.001;
        f.vx *= 0.98; f.vy *= 0.98;
        f.vx = Math.max(-0.65, Math.min(0.65, f.vx));
        f.vy = Math.max(-0.65, Math.min(0.65, f.vy));

        if (mouse) {
          const dx = f.x - mouse.x, dy = f.y - mouse.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          if (d < 110) { const force = (110-d)/110 * 0.07; f.vx += (dx/d)*force; f.vy += (dy/d)*force; }
        }

        f.x += f.vx * sp; f.y += f.vy * sp;
        if (f.x < -12) f.x = canvas.width + 12;
        if (f.x > canvas.width + 12) f.x = -12;
        if (f.y < -12) f.y = canvas.height + 12;
        if (f.y > canvas.height + 12) f.y = -12;

        const alpha = 0.25 + glow * 0.75;
        const glowR = f.r * (2.5 + glow * 4.5);

        const halo = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glowR);
        halo.addColorStop(0, `hsla(${f.hue},100%,68%,${alpha * 0.4})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(f.x, f.y, glowR, 0, Math.PI*2); ctx.fill();

        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.55 + glow * 0.45), 0, Math.PI*2);
        ctx.fillStyle = `hsla(${f.hue},100%,88%,${alpha})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#040803" }} />;
}

// ── Ripple (interactive: click = big splash, auto ripples on dark water) ────────
function Ripple() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface Ring { x:number; y:number; r:number; maxR:number; alpha:number; width:number; hue:number }
    let rings: Ring[] = [];
    let autoTimer = 0;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const spawnRipple = (x: number, y: number, big = false) => {
      const maxR = big
        ? canvas.width * 0.3 + canvas.height * 0.2
        : 70 + Math.random() * 110;
      rings.push({
        x, y, r: 0, maxR,
        alpha: big ? 0.65 : 0.3 + Math.random() * 0.25,
        width: big ? 1.8 : 0.7 + Math.random() * 0.7,
        hue: 185 + Math.random() * 35,
      });
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      spawnRipple(e.clientX - rect.left, e.clientY - rect.top, true);
    };
    window.addEventListener("click", onClick);

    const draw = () => {
      const sp = Math.max(0.3, speedRef.current);
      const dMult = DENSITY_MULT[density] ?? 1;
      ctx.fillStyle = "rgba(3,10,22,0.95)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < canvas.height; y += 36) {
        ctx.strokeStyle = "rgba(0,190,210,0.03)";
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      autoTimer -= sp;
      if (autoTimer <= 0) {
        spawnRipple(Math.random() * canvas.width, Math.random() * canvas.height);
        autoTimer = 55 / Math.max(0.4, sp) / dMult;
      }

      rings = rings.filter(r => r.alpha > 0.007);
      rings.forEach(r => {
        const progress = r.r / r.maxR;
        r.r += (1.6 + progress * 2.4) * sp;
        r.alpha *= (0.986 - 0.004 * sp);

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
        ctx.strokeStyle = `hsla(${r.hue},80%,65%,${r.alpha})`;
        ctx.lineWidth = r.width * (1 - progress * 0.6);
        ctx.stroke();

        if (r.r > 14) {
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.r * 0.83, 0, Math.PI*2);
          ctx.strokeStyle = `hsla(${r.hue},100%,82%,${r.alpha * 0.22})`;
          ctx.lineWidth = r.width * 0.45;
          ctx.stroke();
        }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onClick);
    };
  }, [density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#030a16" }} />;
}

// ── Plasma (vivid morphing color blobs — purple/pink/cyan/amber) ───────────────
function Plasma() {
  const { speed } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  return (
    <div style={{ position:"absolute",inset:0,background:"#0c001e",overflow:"hidden" }}>
      <style>{`
        @keyframes plasma1 { 0%,100%{transform:translate(0%,0%) scale(1)} 30%{transform:translate(14%,9%) scale(1.22)} 65%{transform:translate(-9%,16%) scale(0.83)} }
        @keyframes plasma2 { 0%,100%{transform:translate(0%,0%) scale(1)} 40%{transform:translate(-20%,-12%) scale(1.3)} 75%{transform:translate(11%,-20%) scale(0.88)} }
        @keyframes plasma3 { 0%,100%{transform:translate(0%,0%) scale(1)} 50%{transform:translate(13%,-14%) scale(1.18)} 80%{transform:translate(-6%,10%) scale(0.92)} }
        @keyframes plasma4 { 0%,100%{transform:translate(0%,0%) scale(1)} 35%{transform:translate(-13%,20%) scale(1.12)} 70%{transform:translate(20%,7%) scale(0.94)} }
      `}</style>
      <div style={{ position:"absolute",width:"72%",height:"72%",top:"2%",left:"12%",background:"radial-gradient(ellipse,rgba(139,92,246,0.72) 0%,transparent 65%)",borderRadius:"50%",filter:"blur(52px)",animation:`plasma1 ${13/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"62%",height:"62%",top:"28%",left:"22%",background:"radial-gradient(ellipse,rgba(236,72,153,0.62) 0%,transparent 65%)",borderRadius:"50%",filter:"blur(46px)",animation:`plasma2 ${16/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"58%",height:"58%",top:"12%",left:"38%",background:"radial-gradient(ellipse,rgba(6,182,212,0.55) 0%,transparent 65%)",borderRadius:"50%",filter:"blur(56px)",animation:`plasma3 ${11/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"68%",height:"68%",top:"42%",left:"2%",background:"radial-gradient(ellipse,rgba(251,146,60,0.52) 0%,transparent 65%)",borderRadius:"50%",filter:"blur(62px)",animation:`plasma4 ${19/m}s ease-in-out infinite` }} />
    </div>
  );
}

// ── Custom (user-uploaded photo as cover) ─────────────────────────────────────
function CustomBg() {
  const { customImageUrl } = useBackgroundTheme();
  if (!customImageUrl) {
    return <div style={{ position:"absolute",inset:0,background:"#111" }} />;
  }
  return (
    <img
      src={customImageUrl}
      alt=""
      style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center" }}
    />
  );
}

// ── Shooting Stars (night sky + streaking comets + mouse parallax) ─────────────
function ShootingStars() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    interface StarPt { x:number; y:number; r:number; alpha:number; dAlpha:number }
    interface Comet { x:number; y:number; tx:number; ty:number; len:number; maxLen:number; alpha:number; width:number }
    let stars: StarPt[] = [];
    let comets: Comet[] = [];
    let nextComet = 90;

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      stars = Array.from({ length: Math.round(210 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.1 + 0.3,
        alpha: Math.random() * 0.65 + 0.2,
        dAlpha: (Math.random()-0.5) * 0.005,
      }));
    };
    init();
    window.addEventListener("resize", init);

    const spawnComet = () => {
      const angle = (195 + Math.random()*50) * Math.PI / 180;
      const spd = 7 + Math.random() * 7;
      comets.push({
        x: canvas.width * (0.2 + Math.random() * 0.8),
        y: canvas.height * (Math.random() * 0.45),
        tx: Math.cos(angle) * spd,
        ty: Math.sin(angle) * spd,
        len: 0, maxLen: 90 + Math.random() * 130,
        alpha: 1, width: Math.random() * 1.5 + 0.5,
      });
    };

    const draw = () => {
      const sp = speedRef.current;
      const mouse = mouseRef.current;
      const mx = mouse ? (mouse.x - canvas.width/2) * 0.007 : 0;
      const my = mouse ? (mouse.y - canvas.height/2) * 0.007 : 0;

      ctx.fillStyle = "rgba(3,6,20,0.93)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Comet spawning
      nextComet--;
      if (nextComet <= 0) {
        spawnComet();
        if (Math.random() < 0.25) { setTimeout(spawnComet, 300); }
        nextComet = Math.floor((200 + Math.random()*220) / Math.max(0.5, sp) / (DENSITY_MULT[density] ?? 1));
      }

      // Stars with parallax
      stars.forEach(s => {
        s.alpha += s.dAlpha * sp;
        if (s.alpha < 0.15) s.dAlpha = Math.abs(s.dAlpha);
        if (s.alpha > 0.9) s.dAlpha = -Math.abs(s.dAlpha);
        const px = s.x + mx * 1.8, py = s.y + my * 1.8;
        ctx.beginPath(); ctx.arc(px, py, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(215,225,255,${s.alpha})`; ctx.fill();
      });

      // Comets
      comets = comets.filter(c => c.alpha > 0.015);
      comets.forEach(c => {
        c.x += c.tx * sp; c.y += c.ty * sp;
        const dist = Math.sqrt(c.tx*c.tx + c.ty*c.ty);
        c.len += dist * sp;
        if (c.len > c.maxLen) c.alpha -= 0.028 * sp;

        const tailLen = Math.min(c.len, c.maxLen);
        const normX = c.tx / dist, normY = c.ty / dist;
        const tailX = c.x - normX * tailLen, tailY = c.y - normY * tailLen;

        const grad = ctx.createLinearGradient(tailX, tailY, c.x, c.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.6, `rgba(200,215,255,${c.alpha * 0.3})`);
        grad.addColorStop(1, `rgba(255,255,255,${c.alpha})`);
        ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = c.width;
        ctx.moveTo(tailX, tailY); ctx.lineTo(c.x, c.y); ctx.stroke();

        // Head glow
        const hg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 5);
        hg.addColorStop(0, `rgba(255,255,255,${c.alpha})`); hg.addColorStop(1, "transparent");
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI*2); ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#030614" }} />;
}

export const BACKGROUNDS: BackgroundEntry[] = [
  { key: "aurora",          label: "Aurora",          category: "Creative",      component: Aurora },
  { key: "matrix",          label: "Matrix",           category: "Technical",     component: Matrix,         interactive: true },
  { key: "neural",          label: "Neural",           category: "Technical",     component: Neural,         interactive: true },
  { key: "particles",       label: "Particles",        category: "Minimal",       component: Particles,      interactive: true },
  { key: "grid-pulse",      label: "Grid Pulse",       category: "Professional",  component: GridPulse },
  { key: "constellation",   label: "Constellation",    category: "Creative",      component: Constellation,  interactive: true },
  { key: "topographic",     label: "Topographic",      category: "Professional",  component: Topographic },
  { key: "ink-wash",        label: "Ink Wash",         category: "Minimal",       component: InkWash },
  { key: "neon-grid",       label: "Neon Grid",        category: "Playful",       component: NeonGrid },
  { key: "wave",            label: "Ocean Wave",       category: "Playful",       component: Wave },
  { key: "fireflies",       label: "Fireflies",        category: "Minimal",       component: Fireflies,      interactive: true },
  { key: "shooting-stars",  label: "Shooting Stars",   category: "Creative",      component: ShootingStars,  interactive: true },
  { key: "ripple",          label: "Ripple",           category: "Creative",      component: Ripple,         interactive: true },
  { key: "plasma",          label: "Plasma",           category: "Creative",      component: Plasma },
  { key: "custom",          label: "My Photo",         category: "Minimal",       component: CustomBg },
];

export function getBackground(key: string): BackgroundEntry | undefined {
  return BACKGROUNDS.find(b => b.key === key);
}
