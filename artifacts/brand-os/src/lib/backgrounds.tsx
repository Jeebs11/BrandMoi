import { useEffect, useRef } from "react";
import { useBackgroundTheme, usePageVisible, SPEED_MULT, DENSITY_MULT, BG_PALETTES } from "@/lib/background-context";

export interface BackgroundEntry {
  key: string;
  label: string;
  category: "Zen" | "Default" | "Minimal" | "Professional" | "Creative" | "Technical" | "Playful";
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

    let _lf1 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf1 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf1 = _now;

      if (document.hidden) return;
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
    const onVisible_matrix = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_matrix);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener('visibilitychange', onVisible_matrix); };
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

    let _lf2 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf2 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf2 = _now;

      if (document.hidden) return;
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
    const onVisible_neural = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_neural);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
      window.removeEventListener("click", onClick);
      document.removeEventListener('visibilitychange', onVisible_neural);
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

    let _lf3 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf3 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf3 = _now;

      if (document.hidden) return;
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
    const onVisible_particles = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_particles);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
      window.removeEventListener("click", onClick);
      document.removeEventListener('visibilitychange', onVisible_particles);
    };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#111827" }} />;
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

    let _lf4 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf4 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf4 = _now;

      if (document.hidden) return;
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
    const onVisible_constellation = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_constellation);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); document.removeEventListener('visibilitychange', onVisible_constellation); };
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
// ── ZenWaves: continuous layered sine waves on canvas — no SVG keyframe snap ──
type WaveVariant = { sky: [string, string, string]; layers: Array<{ color: string; amp: number; period: number; speed: number; base: number }>; glow?: { color: string; x: number; y: number } };

const WAVE_VARIANTS: Record<string, WaveVariant> = {
  ocean: {
    sky: ["#0a1a20", "#14333d", "#1d4a57"],
    glow: { color: "rgba(160,220,235,0.10)", x: 0.72, y: 0.22 },
    layers: [
      { color: "rgba(6,182,212,0.13)",  amp: 22, period: 480, speed: 0.012, base: 0.62 },
      { color: "rgba(8,145,178,0.16)",  amp: 28, period: 360, speed: -0.009, base: 0.72 },
      { color: "rgba(14,116,144,0.22)", amp: 20, period: 300, speed: 0.016, base: 0.82 },
    ],
  },
  sunset: {
    sky: ["#150503", "#3d1206", "#6b2408"],
    glow: { color: "rgba(255,150,60,0.16)", x: 0.5, y: 0.46 },
    layers: [
      { color: "rgba(230,95,25,0.16)",  amp: 22, period: 460, speed: 0.011, base: 0.62 },
      { color: "rgba(245,130,40,0.12)", amp: 28, period: 340, speed: -0.008, base: 0.72 },
      { color: "rgba(200,60,12,0.22)",  amp: 18, period: 280, speed: 0.015, base: 0.83 },
    ],
  },
  arctic: {
    sky: ["#02070f", "#051527", "#0a2440"],
    glow: { color: "rgba(190,230,255,0.09)", x: 0.3, y: 0.18 },
    layers: [
      { color: "rgba(186,230,253,0.09)", amp: 20, period: 500, speed: 0.010, base: 0.62 },
      { color: "rgba(150,210,245,0.07)", amp: 26, period: 370, speed: -0.007, base: 0.72 },
      { color: "rgba(125,211,252,0.13)", amp: 18, period: 290, speed: 0.013, base: 0.83 },
    ],
  },
  night: {
    sky: ["#00030a", "#020617", "#040b26"],
    glow: { color: "rgba(150,170,255,0.07)", x: 0.78, y: 0.16 },
    layers: [
      { color: "rgba(70,90,190,0.11)", amp: 22, period: 470, speed: 0.010, base: 0.63 },
      { color: "rgba(50,65,170,0.09)", amp: 27, period: 350, speed: -0.008, base: 0.73 },
      { color: "rgba(36,50,150,0.17)", amp: 18, period: 285, speed: 0.014, base: 0.84 },
    ],
  },
};

function ZenWaves({ variant }: { variant: keyof typeof WAVE_VARIANTS }) {
  const { speed } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cfg = WAVE_VARIANTS[variant];
    let raf: number;
    let t = 0;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    let _lf5 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf5 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf5 = _now;

      if (document.hidden) return;
      const sp = speedRef.current;
      t += sp;
      const W = canvas.width, H = canvas.height;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, cfg.sky[0]); sky.addColorStop(0.5, cfg.sky[1]); sky.addColorStop(1, cfg.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      if (cfg.glow) {
        const g = ctx.createRadialGradient(W*cfg.glow.x, H*cfg.glow.y, 0, W*cfg.glow.x, H*cfg.glow.y, Math.min(W,H)*0.55);
        g.addColorStop(0, cfg.glow.color); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      cfg.layers.forEach((l, li) => {
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 6) {
          const y = H * l.base
            + Math.sin((x / l.period) * Math.PI * 2 + t * l.speed) * l.amp
            + Math.sin((x / (l.period * 0.53)) * Math.PI * 2 - t * l.speed * 1.6 + li * 2) * (l.amp * 0.4);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = l.color;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    const onVisible = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener("visibilitychange", onVisible);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisible); };
  }, [variant]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%" }} />;
}

function Wave() { return <ZenWaves variant="ocean" />; }

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

    let _lf6 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf6 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf6 = _now;

      if (document.hidden) return;
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
    const onVisible_fireflies = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_fireflies);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); document.removeEventListener('visibilitychange', onVisible_fireflies); };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#040803" }} />;
}

// ── Ripple (interactive: click = big splash, auto ripples — palette coloured) ───
function Ripple() {
  const { speed, density, bgPalette } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  const palRef = useRef(BG_PALETTES[bgPalette] ?? BG_PALETTES.ocean);

  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);
  useEffect(() => { palRef.current = BG_PALETTES[bgPalette] ?? BG_PALETTES.ocean; }, [bgPalette]);

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
      const pal = palRef.current;
      const maxR = big
        ? canvas.width * 0.3 + canvas.height * 0.2
        : 70 + Math.random() * 110;
      rings.push({
        x, y, r: 0, maxR,
        alpha: big ? 0.65 : 0.3 + Math.random() * 0.25,
        width: big ? 1.8 : 0.7 + Math.random() * 0.7,
        hue: pal.hueBase + Math.random() * pal.hueSpread,
      });
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      spawnRipple(e.clientX - rect.left, e.clientY - rect.top, true);
    };
    window.addEventListener("click", onClick);

    let _lf7 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf7 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf7 = _now;

      if (document.hidden) return;
      const pal = palRef.current;
      const sp = Math.max(0.3, speedRef.current);
      const dMult = DENSITY_MULT[density] ?? 1;
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const vg = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height) * 0.25,
        canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height) * 0.75
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      autoTimer -= sp;
      if (autoTimer <= 0) {
        spawnRipple(Math.random() * canvas.width, Math.random() * canvas.height);
        autoTimer = 110 / Math.max(0.4, sp) / dMult;
      }

      rings = rings.filter(r => r.alpha > 0.007);
      rings.forEach(r => {
        const progress = r.r / r.maxR;
        r.r += (1.6 + progress * 2.4) * sp;
        r.alpha *= (0.986 - 0.004 * sp);

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${r.hue},${pal.saturation}%,${pal.lightness}%,${r.alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
        ctx.strokeStyle = `hsla(${r.hue},${pal.saturation}%,${pal.lightness}%,${r.alpha})`;
        ctx.lineWidth = r.width * (1 - progress * 0.6);
        ctx.stroke();
        ctx.restore();

        if (r.r > 14) {
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.r * 0.83, 0, Math.PI*2);
          ctx.strokeStyle = `hsla(${r.hue},${Math.min(100,pal.saturation+15)}%,${Math.min(95,pal.lightness+15)}%,${r.alpha * 0.22})`;
          ctx.lineWidth = r.width * 0.45;
          ctx.stroke();
        }
      });
      raf = requestAnimationFrame(draw);
    };
    const onVisible_ripple = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_ripple);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onClick);
      document.removeEventListener('visibilitychange', onVisible_ripple);
    };
  }, [density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:(BG_PALETTES[bgPalette]??BG_PALETTES.ocean).bg }} />;
}

// ── Plasma (morphing colour blobs — palette coloured) ─────────────────────────
function Plasma() {
  const { speed, bgPalette } = useBackgroundTheme();
  const m = SPEED_MULT[speed] ?? 1;
  const pal = BG_PALETTES[bgPalette] ?? BG_PALETTES.ocean;
  const { hueBase, hueSpread, saturation, lightness } = pal;
  const h1 = hueBase;
  const h2 = (hueBase + hueSpread * 0.35) % 360;
  const h3 = (hueBase + hueSpread * 0.65) % 360;
  const h4 = (hueBase + hueSpread * 0.90) % 360;
  return (
    <div style={{ position:"absolute",inset:0,background:pal.bg,overflow:"hidden" }}>
      <style>{`
        @keyframes plasma1 { 0%,100%{transform:translate(0%,0%) scale(1)} 30%{transform:translate(14%,9%) scale(1.22)} 65%{transform:translate(-9%,16%) scale(0.83)} }
        @keyframes plasma2 { 0%,100%{transform:translate(0%,0%) scale(1)} 40%{transform:translate(-20%,-12%) scale(1.3)} 75%{transform:translate(11%,-20%) scale(0.88)} }
        @keyframes plasma3 { 0%,100%{transform:translate(0%,0%) scale(1)} 50%{transform:translate(13%,-14%) scale(1.18)} 80%{transform:translate(-6%,10%) scale(0.92)} }
        @keyframes plasma4 { 0%,100%{transform:translate(0%,0%) scale(1)} 35%{transform:translate(-13%,20%) scale(1.12)} 70%{transform:translate(20%,7%) scale(0.94)} }
      `}</style>
      <div style={{ position:"absolute",width:"72%",height:"72%",top:"2%",left:"12%",background:`radial-gradient(ellipse,hsla(${h1},${saturation}%,${lightness}%,0.72) 0%,transparent 65%)`,borderRadius:"50%",filter:"blur(52px)",animation:`plasma1 ${13/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"62%",height:"62%",top:"28%",left:"22%",background:`radial-gradient(ellipse,hsla(${h2},${Math.max(0,saturation-5)}%,${Math.max(0,lightness-5)}%,0.62) 0%,transparent 65%)`,borderRadius:"50%",filter:"blur(46px)",animation:`plasma2 ${16/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"58%",height:"58%",top:"12%",left:"38%",background:`radial-gradient(ellipse,hsla(${h3},${saturation}%,${Math.min(95,lightness+5)}%,0.55) 0%,transparent 65%)`,borderRadius:"50%",filter:"blur(56px)",animation:`plasma3 ${11/m}s ease-in-out infinite` }} />
      <div style={{ position:"absolute",width:"68%",height:"68%",top:"42%",left:"2%",background:`radial-gradient(ellipse,hsla(${h4},${Math.max(0,saturation-8)}%,${Math.max(0,lightness-3)}%,0.52) 0%,transparent 65%)`,borderRadius:"50%",filter:"blur(62px)",animation:`plasma4 ${19/m}s ease-in-out infinite` }} />
    </div>
  );
}

// ── Prismatic (interactive: mouse X maps palette hue range, auto-cycles idle) ──
function Prismatic() {
  const { speed, bgPalette } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palRef = useRef(BG_PALETTES[bgPalette] ?? BG_PALETTES.ocean);
  const hueRef = useRef(palRef.current.hueBase);
  const targetHueRef = useRef(palRef.current.hueBase);
  const mouseRef = useWindowMouse(canvasRef);

  useEffect(() => {
    palRef.current = BG_PALETTES[bgPalette] ?? BG_PALETTES.ocean;
    targetHueRef.current = palRef.current.hueBase;
  }, [bgPalette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const m = SPEED_MULT[speed] ?? 1;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    let _lf8 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf8 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf8 = _now;

      if (document.hidden) return;
      const pal = palRef.current;
      const mouse = mouseRef.current;
      if (mouse) {
        targetHueRef.current = pal.hueBase + (mouse.x / Math.max(1, canvas.width)) * pal.hueSpread;
      } else {
        targetHueRef.current += 0.14 * m;
        if (targetHueRef.current > pal.hueBase + pal.hueSpread) targetHueRef.current = pal.hueBase;
      }
      hueRef.current += (targetHueRef.current - hueRef.current) * 0.05;
      const h = hueRef.current;
      const sp = pal.hueSpread;

      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0,   `hsl(${h},52%,7%)`);
      g.addColorStop(0.4, `hsl(${(h + sp * 0.25) % 360},56%,10%)`);
      g.addColorStop(0.7, `hsl(${(h + sp * 0.5) % 360},50%,9%)`);
      g.addColorStop(1,   `hsl(${(h + sp * 0.75) % 360},46%,7%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const bloom = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.42, 0,
        canvas.width * 0.5, canvas.height * 0.42, canvas.width * 0.52,
      );
      bloom.addColorStop(0, `hsla(${(h + sp * 0.2) % 360},${pal.saturation}%,${pal.lightness}%,0.13)`);
      bloom.addColorStop(0.5, `hsla(${(h + sp * 0.2) % 360},${pal.saturation - 10}%,${pal.lightness - 13}%,0.06)`);
      bloom.addColorStop(1, "transparent");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (mouse) {
        const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 85);
        mg.addColorStop(0, `hsla(${h},${pal.saturation}%,${pal.lightness}%,0.15)`);
        mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      raf = requestAnimationFrame(draw);
    };
    const onVisible_prismatic = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisible_prismatic);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener('visibilitychange', onVisible_prismatic); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mouseRef]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%" }} />;
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
    interface StarPt { x:number; y:number; r:number; alpha:number; dAlpha:number; glow:boolean }
    interface Comet { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; width:number; hue:number }
    let stars: StarPt[] = [];
    let comets: Comet[] = [];
    let nextComet = 140;

    const paintSky = () => {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#020414");
      g.addColorStop(0.55, "#050a1e");
      g.addColorStop(1, "#03061a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      stars = Array.from({ length: Math.round(190 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.1 + 0.3,
        alpha: Math.random() * 0.6 + 0.15,
        dAlpha: (Math.random()-0.5) * 0.0022,
        glow: Math.random() < 0.06,
      }));
      paintSky();
    };
    init();
    window.addEventListener("resize", init);

    const spawnComet = () => {
      const fromLeft = Math.random() < 0.6;
      const x = fromLeft ? -30 : canvas.width * (0.1 + Math.random() * 0.6);
      const y = fromLeft ? canvas.height * (0.05 + Math.random() * 0.3) : -20;
      const spd = 3.2 + Math.random() * 2.4;
      const angle = (18 + Math.random() * 22) * Math.PI / 180;
      comets.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0,
        maxLife: 150 + Math.random() * 110,
        width: 1 + Math.random() * 1.2,
        hue: 210 + Math.random() * 40,
      });
    };

    let _lf9 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf9 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf9 = _now;

      if (document.hidden) return;
      const sp = speedRef.current;
      const mouse = mouseRef.current;
      const mx = mouse ? (mouse.x - canvas.width/2) * 0.004 : 0;
      const my = mouse ? (mouse.y - canvas.height/2) * 0.004 : 0;

      // Low-alpha veil: frames linger, painting soft persistent comet trails
      ctx.fillStyle = "rgba(3,6,22,0.16)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const bandGrad = ctx.createLinearGradient(0, canvas.height * 0.1, canvas.width, canvas.height * 0.55);
      bandGrad.addColorStop(0, "rgba(120,140,220,0)");
      bandGrad.addColorStop(0.5, "rgba(140,160,235,0.018)");
      bandGrad.addColorStop(1, "rgba(120,140,220,0)");
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach(st => {
        st.alpha += st.dAlpha * sp;
        if (st.alpha < 0.1) st.dAlpha = Math.abs(st.dAlpha);
        if (st.alpha > 0.8) st.dAlpha = -Math.abs(st.dAlpha);
        const px = st.x + mx * 1.6, py = st.y + my * 1.6;
        if (st.glow) {
          const hg = ctx.createRadialGradient(px, py, 0, px, py, st.r * 6);
          hg.addColorStop(0, `rgba(200,215,255,${st.alpha * 0.5})`);
          hg.addColorStop(1, "transparent");
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(px, py, st.r * 6, 0, Math.PI*2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, st.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(218,228,255,${st.alpha})`;
        ctx.fill();
      });

      nextComet -= sp;
      if (nextComet <= 0) {
        spawnComet();
        nextComet = (380 + Math.random() * 420) / Math.max(0.5, sp);
      }

      comets = comets.filter(c => c.life < c.maxLife && c.x < canvas.width + 60 && c.y < canvas.height + 60);
      comets.forEach(c => {
        c.x += c.vx * sp;
        c.y += c.vy * sp;
        c.vy += 0.006 * sp;
        c.life += sp;

        const t = c.life / c.maxLife;
        const fade = t < 0.15 ? t / 0.15 : t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1;

        const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 8);
        halo.addColorStop(0, `hsla(${c.hue},80%,92%,${0.9 * fade})`);
        halo.addColorStop(0.4, `hsla(${c.hue},75%,75%,${0.25 * fade})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI*2); ctx.fill();

        const mag = Math.sqrt(c.vx*c.vx + c.vy*c.vy);
        const nx = c.vx / mag, ny = c.vy / mag;
        const coreLen = 26 * fade;
        const grad = ctx.createLinearGradient(c.x - nx*coreLen, c.y - ny*coreLen, c.x, c.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, `hsla(${c.hue},85%,95%,${fade})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = c.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.x - nx*coreLen, c.y - ny*coreLen);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      });

      raf = requestAnimationFrame(draw);
    };
    const onVisible_shooting = () => { if (!document.hidden) { paintSky(); raf = requestAnimationFrame(draw); } };
    document.addEventListener('visibilitychange', onVisible_shooting);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", init); document.removeEventListener('visibilitychange', onVisible_shooting); };
  }, [mouseRef, density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#020414" }} />;
}

function WaveSunset() { return <ZenWaves variant="sunset" />; }
function WaveArctic() { return <ZenWaves variant="arctic" />; }
function WaveNight() { return <ZenWaves variant="night" />; }

// ── Aurora: slow drifting light ribbons over a starlit sky — pure zen ─────────
function Aurora() {
  const { speed, density } = useBackgroundTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(SPEED_MULT[speed] ?? 1);
  useEffect(() => { speedRef.current = SPEED_MULT[speed] ?? 1; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;
    interface StarPt { x:number; y:number; r:number; alpha:number; dAlpha:number }
    let stars: StarPt[] = [];

    const RIBBONS = [
      { hue: 150, sat: 70, base: 0.32, amp: 0.07, period: 1.6, speed: 0.0042, width: 0.16, alpha: 0.16 },
      { hue: 180, sat: 65, base: 0.42, amp: 0.06, period: 2.2, speed: -0.0031, width: 0.13, alpha: 0.12 },
      { hue: 270, sat: 55, base: 0.28, amp: 0.08, period: 2.8, speed: 0.0024, width: 0.18, alpha: 0.09 },
    ];

    const resize = () => {
      canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
      stars = Array.from({ length: Math.round(110 * (DENSITY_MULT[density] ?? 1)) }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 0.9 + 0.3,
        alpha: Math.random() * 0.5 + 0.1,
        dAlpha: (Math.random()-0.5) * 0.002,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    let _lf10 = 0;
    const draw = (_t?: number) => {
      const _now = _t ?? performance.now();
      if (_now - _lf10 < 33) { raf = requestAnimationFrame(draw); return; }
      _lf10 = _now;

      if (document.hidden) return;
      const sp = speedRef.current;
      t += sp;
      const W = canvas.width, H = canvas.height;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#010613"); sky.addColorStop(0.6, "#03102a"); sky.addColorStop(1, "#020a1c");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      stars.forEach(st => {
        st.alpha += st.dAlpha * sp;
        if (st.alpha < 0.06) st.dAlpha = Math.abs(st.dAlpha);
        if (st.alpha > 0.65) st.dAlpha = -Math.abs(st.dAlpha);
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(210,225,255,${st.alpha})`;
        ctx.fill();
      });

      RIBBONS.forEach((rb, ri) => {
        const breathe = 0.75 + Math.sin(t * 0.0016 + ri * 2.1) * 0.25;
        for (let x = 0; x <= W; x += 10) {
          const yC = H * (rb.base + Math.sin((x / W) * Math.PI * rb.period + t * rb.speed) * rb.amp
            + Math.sin((x / W) * Math.PI * rb.period * 2.3 - t * rb.speed * 1.7) * rb.amp * 0.35);
          const h = H * rb.width * (0.8 + Math.sin((x / W) * 6 + t * 0.003 + ri) * 0.2);
          const g = ctx.createLinearGradient(0, yC - h/2, 0, yC + h/2);
          const a = rb.alpha * breathe;
          g.addColorStop(0, `hsla(${rb.hue},${rb.sat}%,60%,0)`);
          g.addColorStop(0.5, `hsla(${rb.hue},${rb.sat}%,62%,${a})`);
          g.addColorStop(1, `hsla(${rb.hue},${rb.sat}%,60%,0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x, yC - h/2, 10, h);
        }
      });

      raf = requestAnimationFrame(draw);
    };
    const onVisible = () => { if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener("visibilitychange", onVisible);
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisible); };
  }, [density]);

  return <canvas ref={canvasRef} style={{ position:"absolute",inset:0,width:"100%",height:"100%",background:"#010613" }} />;
}

export const BACKGROUNDS: BackgroundEntry[] = [
  // ── Zen ──
  { key: "shooting-stars",  label: "Night Sky",    category: "Zen", component: ShootingStars, interactive: true },
  { key: "ripple",          label: "Still Water",  category: "Zen", component: Ripple,        interactive: true },
  { key: "aurora",          label: "Aurora",       category: "Zen", component: Aurora },
  { key: "wave",            label: "Ocean Wave",   category: "Zen", component: Wave },
  { key: "wave-sunset",     label: "Sunset Wave",  category: "Zen", component: WaveSunset },
  { key: "wave-arctic",     label: "Arctic Wave",  category: "Zen", component: WaveArctic },
  { key: "wave-night",      label: "Night Wave",   category: "Zen", component: WaveNight },

  // ── Default ──
  { key: "custom",          label: "My Photo",     category: "Default", component: CustomBg },
];

export function getBackground(key: string): BackgroundEntry | undefined {
  return BACKGROUNDS.find(b => b.key === key);
}
