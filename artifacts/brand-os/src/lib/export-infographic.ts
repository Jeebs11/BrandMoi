import { toPng } from "html-to-image";

const CARD_W = 1080;
const CARD_H = 1080;
const PAD_X = 96;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

export type InfographicAnimPreset = "reveal" | "fade" | "typewriter" | "rise" | "pop" | "wipe";

export const INFOGRAPHIC_BASE_DURATIONS: Record<InfographicAnimPreset, number> = {
  reveal: 7000,
  fade: 4500,
  typewriter: 9000,
  rise: 6500,
  pop: 7000,
  wipe: 5000,
};

const DEFAULT_BG = "#0f172a";
const DEFAULT_ACCENT = "#6366f1";
const DEFAULT_TEXT = "#ffffff";

// ── HTML renderer (for preview & static PNG export) ──────────────────────────

function buildEl(
  headline: string,
  bullets: string[],
  bgColor: string,
  accentColor: string,
  textColor: string
): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    `width:${CARD_W}px`,
    `height:${CARD_H}px`,
    `background:${bgColor}`,
    "display:flex",
    "flex-direction:column",
    "justify-content:center",
    "box-sizing:border-box",
    `padding:0 ${PAD_X}px`,
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  ].join(";");

  // Accent bar
  const bar = document.createElement("div");
  bar.style.cssText = `width:56px;height:4px;background:${accentColor};border-radius:2px;margin-bottom:48px;flex-shrink:0`;
  el.appendChild(bar);

  // Headline
  const title = document.createElement("div");
  title.style.cssText = [
    `color:${textColor}`,
    "font-size:62px",
    "font-weight:800",
    "line-height:1.1",
    "letter-spacing:-1px",
    "word-break:break-word",
    "margin-bottom:56px",
    "flex-shrink:0",
  ].join(";");
  title.textContent = headline;
  el.appendChild(title);

  // Bullets
  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:28px;flex-shrink:0";
  for (const bullet of bullets) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:flex-start;gap:22px";

    const dot = document.createElement("div");
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${accentColor};flex-shrink:0;margin-top:16px`;

    const txt = document.createElement("div");
    txt.style.cssText = [
      `color:${textColor}`,
      "font-size:38px",
      "font-weight:500",
      "line-height:1.35",
      "opacity:0.88",
      "word-break:break-word",
    ].join(";");
    txt.textContent = bullet;

    row.appendChild(dot);
    row.appendChild(txt);
    list.appendChild(row);
  }
  el.appendChild(list);
  return el;
}

function createWrapper(): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;overflow:hidden;width:${CARD_W}px;height:${CARD_H}px`;
  return wrapper;
}

export async function previewInfographic(
  headline: string,
  bullets: string[],
  bgColor = DEFAULT_BG,
  accentColor = DEFAULT_ACCENT,
  textColor = DEFAULT_TEXT
): Promise<string> {
  const el = buildEl(headline, bullets, bgColor, accentColor, textColor);
  const wrapper = createWrapper();
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  try {
    return await toPng(el, { width: CARD_W, height: CARD_H, pixelRatio: 0.28, skipFonts: true });
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function downloadInfographic(
  headline: string,
  bullets: string[],
  topic: string,
  bgColor = DEFAULT_BG,
  accentColor = DEFAULT_ACCENT,
  textColor = DEFAULT_TEXT
): Promise<void> {
  const el = buildEl(headline, bullets, bgColor, accentColor, textColor);
  const wrapper = createWrapper();
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  try {
    const dataUrl = await toPng(el, { width: CARD_W, height: CARD_H, pixelRatio: 2, skipFonts: true });
    const a = document.createElement("a");
    const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "infographic";
    a.download = `${safeName}-infographic.png`;
    a.href = dataUrl;
    a.click();
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ── Canvas animation renderer ─────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}
function phase(t: number, start: number, end: number): number {
  return clamp((t - start) / (end - start));
}
function easeOut(t: number, exp = 3): number {
  return 1 - Math.pow(1 - t, exp);
}
function easeOutBack(t: number, overshoot = 1.7): number {
  // Cubic with overshoot — dot springs past target then settles
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

// Progressively reveal wrapped lines character-by-character.
// progress 0→1 maps to revealing all chars across all lines sequentially.
function typewriterLines(lines: string[], progress: number): string[] {
  const total = lines.reduce((s, l) => s + l.length, 0);
  let remaining = Math.round(total * progress);
  return lines.map(line => {
    if (remaining <= 0) return "";
    const take = Math.min(line.length, remaining);
    remaining -= take;
    return line.slice(0, take);
  });
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  if (w <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface InfoLayout {
  barY: number;
  headlineLines: string[];
  headlineY: number;  // baseline of first line
  headlineLineH: number;
  headlineFontSize: number;
  bullets: {
    lines: string[];
    lineY: number;  // baseline of first text line
    dotCY: number; // center-y of bullet dot
    lineH: number;
  }[];
  bulletFontSize: number;
}

const HEADLINE_SIZES = [
  { size: 62, lineH: 74 },
  { size: 52, lineH: 62 },
  { size: 44, lineH: 54 },
];
const BULLET_SIZES = [
  { size: 38, lineH: 52 },
  { size: 32, lineH: 44 },
];
const BULLET_GAP = 28;
const DOT_R = 5;
const DOT_GAP = 22;  // space between dot and text
const DOT_EFFECTIVE_W = DOT_R * 2 + DOT_GAP;
const BAR_TO_HEADLINE = 48;
const HEADLINE_TO_BULLETS = 56;
const MIN_PAD = 80;

function buildInfoLayout(
  ctx: CanvasRenderingContext2D,
  headline: string,
  bullets: string[]
): InfoLayout {
  const maxHeadlineW = CARD_W - PAD_X * 2;
  const maxBulletW = CARD_W - PAD_X * 2 - DOT_EFFECTIVE_W;

  let headlineSize = HEADLINE_SIZES[HEADLINE_SIZES.length - 1];
  let headlineLines: string[] = [];

  for (const candidate of HEADLINE_SIZES) {
    ctx.font = `800 ${candidate.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    const lines = wrapWords(ctx, headline, maxHeadlineW);
    if (lines.length <= 3) {
      headlineSize = candidate;
      headlineLines = lines;
      break;
    }
    headlineLines = lines;
    headlineSize = candidate;
  }

  let bulletSize = BULLET_SIZES[BULLET_SIZES.length - 1];
  const bulletLineGroups: string[][] = [];

  for (const candidate of BULLET_SIZES) {
    ctx.font = `500 ${candidate.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    bulletLineGroups.length = 0;
    for (const b of bullets) {
      bulletLineGroups.push(wrapWords(ctx, b, maxBulletW));
    }
    const maxBLines = Math.max(...bulletLineGroups.map(g => g.length));
    if (maxBLines <= 2) {
      bulletSize = candidate;
      break;
    }
    bulletSize = candidate;
  }

  // Compute total block height
  const barH = 4;
  const headlineH = headlineLines.length * headlineSize.lineH;
  const bulletsTotalH = bulletLineGroups.reduce((sum, g, i) => {
    return sum + g.length * bulletSize.lineH + (i < bulletLineGroups.length - 1 ? BULLET_GAP : 0);
  }, 0);
  const totalH = barH + BAR_TO_HEADLINE + headlineH + HEADLINE_TO_BULLETS + bulletsTotalH;

  const blockTop = Math.max(MIN_PAD, (CARD_H - totalH) / 2);
  let curY = blockTop;
  const barY = curY;
  curY += barH + BAR_TO_HEADLINE;

  const headlineY = curY + headlineSize.lineH;
  curY += headlineH + HEADLINE_TO_BULLETS;

  const bulletLayouts: InfoLayout["bullets"] = [];
  for (let i = 0; i < bulletLineGroups.length; i++) {
    const lines = bulletLineGroups[i];
    const lineY = curY + bulletSize.lineH;
    const dotCY = curY + bulletSize.lineH / 2;
    const h = lines.length * bulletSize.lineH;
    bulletLayouts.push({ lines, lineY, dotCY, lineH: bulletSize.lineH });
    curY += h + (i < bulletLineGroups.length - 1 ? BULLET_GAP : 0);
  }

  return {
    barY,
    headlineLines,
    headlineY,
    headlineLineH: headlineSize.lineH,
    headlineFontSize: headlineSize.size,
    bullets: bulletLayouts,
    bulletFontSize: bulletSize.size,
  };
}

function drawBar(ctx: CanvasRenderingContext2D, layout: InfoLayout, accentColor: string, progress = 1, alpha = 1) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = accentColor;
  fillRoundRect(ctx, PAD_X, layout.barY, 56 * progress, 4, 2);
  ctx.restore();
}

function drawHeadline(ctx: CanvasRenderingContext2D, layout: InfoLayout, textColor: string, alpha = 1, offsetY = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = textColor;
  ctx.font = `800 ${layout.headlineFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  let y = layout.headlineY + offsetY;
  for (const line of layout.headlineLines) {
    ctx.fillText(line, PAD_X, y);
    y += layout.headlineLineH;
  }
  ctx.restore();
}

function drawBullet(
  ctx: CanvasRenderingContext2D,
  layout: InfoLayout,
  idx: number,
  accentColor: string,
  textColor: string,
  alpha = 1,
  offsetX = 0,
  offsetY = 0,
  overrideLines?: string[]
) {
  const bl = layout.bullets[idx];
  ctx.save();
  ctx.globalAlpha = alpha;

  // Dot
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(PAD_X + DOT_R + offsetX, bl.dotCY + offsetY, DOT_R, 0, Math.PI * 2);
  ctx.fill();

  // Text lines
  ctx.fillStyle = textColor;
  ctx.globalAlpha = alpha * 0.88;
  ctx.font = `500 ${layout.bulletFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  let y = bl.lineY + offsetY;
  for (const line of (overrideLines ?? bl.lines)) {
    ctx.fillText(line, PAD_X + DOT_EFFECTIVE_W + offsetX, y);
    y += bl.lineH;
  }
  ctx.restore();
}

// Pop preset: dot scales in with overshoot, text fades in alongside
function drawBulletPop(
  ctx: CanvasRenderingContext2D,
  layout: InfoLayout,
  idx: number,
  accentColor: string,
  textColor: string,
  dotScale: number,
  textAlpha: number
) {
  const bl = layout.bullets[idx];
  ctx.save();

  // Dot with scale transform around its center
  const cx = PAD_X + DOT_R;
  const cy = bl.dotCY;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dotScale, dotScale);
  ctx.translate(-cx, -cy);
  ctx.arc(cx, cy, DOT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Text fades in
  ctx.globalAlpha = textAlpha * 0.88;
  ctx.fillStyle = textColor;
  ctx.font = `500 ${layout.bulletFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  let y = bl.lineY;
  for (const line of bl.lines) {
    ctx.fillText(line, PAD_X + DOT_EFFECTIVE_W, y);
    y += bl.lineH;
  }
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  layout: InfoLayout,
  bgColor: string,
  accentColor: string,
  textColor: string,
  preset: InfographicAnimPreset,
  t: number
) {
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  const n = layout.bullets.length;

  // ── Fade ────────────────────────────────────────────────────────────────────
  if (preset === "fade") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const alpha = easeOut(phase(t, 0, 0.65), 2);
    drawBar(ctx, layout, accentColor, alpha, alpha);
    drawHeadline(ctx, layout, textColor, alpha);
    for (let i = 0; i < n; i++) {
      drawBullet(ctx, layout, i, accentColor, textColor, alpha);
    }

  // ── Reveal ──────────────────────────────────────────────────────────────────
  } else if (preset === "reveal") {
    const bgAlpha = easeOut(phase(t, 0, 0.08));
    ctx.globalAlpha = bgAlpha;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.globalAlpha = 1;

    const barProg = easeOut(phase(t, 0.08, 0.22));
    drawBar(ctx, layout, accentColor, barProg, clamp(barProg * 4));

    const hAlpha = easeOut(phase(t, 0.18, 0.38), 2);
    const hOffY = 50 * (1 - easeOut(phase(t, 0.18, 0.4), 3));
    drawHeadline(ctx, layout, textColor, hAlpha, hOffY);

    for (let i = 0; i < n; i++) {
      const start = 0.38 + i * (0.52 / n);
      const end = start + 0.14;
      const bAlpha = easeOut(phase(t, start, end), 2);
      const bOffX = -60 * (1 - easeOut(phase(t, start, end + 0.06), 3));
      drawBullet(ctx, layout, i, accentColor, textColor, bAlpha, bOffX);
    }

  // ── Typewriter ──────────────────────────────────────────────────────────────
  // bg appears → headline types char-by-char → each bullet types in staggered
  } else if (preset === "typewriter") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Bar draws in quickly
    const barProg = easeOut(phase(t, 0, 0.06));
    drawBar(ctx, layout, accentColor, barProg, clamp(barProg * 5));

    // Headline types between t=0.06 and t=0.32
    const hTypeProg = phase(t, 0.06, 0.32);
    if (hTypeProg > 0) {
      const typedLines = typewriterLines(layout.headlineLines, hTypeProg);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = textColor;
      ctx.font = `800 ${layout.headlineFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
      let hy = layout.headlineY;
      for (const line of typedLines) {
        ctx.fillText(line, PAD_X, hy);
        // Blinking cursor on the active typing line
        if (line.length > 0 && hTypeProg < 1) {
          const w = ctx.measureText(line).width;
          const cursorVisible = Math.floor(t * 8) % 2 === 0;
          if (cursorVisible) {
            ctx.fillRect(PAD_X + w + 4, hy - layout.headlineFontSize * 0.85, 3, layout.headlineFontSize * 0.9);
          }
        }
        hy += layout.headlineLineH;
      }
      ctx.restore();
    }

    // Bullets type in staggered from t=0.36
    const bulletRange = 0.94 - 0.36;
    const perBullet = bulletRange / n;
    for (let i = 0; i < n; i++) {
      const start = 0.36 + i * perBullet;
      const end = start + perBullet * 0.85;
      const bProg = phase(t, start, end);
      if (bProg > 0) {
        const typedBulletLines = typewriterLines(layout.bullets[i].lines, bProg);
        const showCursor = bProg < 1 && Math.floor(t * 8) % 2 === 0;
        const dotAlpha = clamp(bProg * 8);
        drawBullet(ctx, layout, i, accentColor, textColor, dotAlpha, 0, 0, typedBulletLines);
        // Cursor after last typed char of this bullet
        if (showCursor) {
          const lastLine = typedBulletLines[typedBulletLines.length - 1] ?? "";
          const lineIdx = typedBulletLines.findLastIndex(l => l.length > 0);
          if (lineIdx >= 0) {
            ctx.save();
            ctx.fillStyle = textColor;
            ctx.globalAlpha = 0.7;
            ctx.font = `500 ${layout.bulletFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
            const lineY = layout.bullets[i].lineY + lineIdx * layout.bullets[i].lineH;
            const w = ctx.measureText(lastLine).width;
            ctx.fillRect(PAD_X + DOT_EFFECTIVE_W + w + 3, lineY - layout.bulletFontSize * 0.82, 2, layout.bulletFontSize * 0.85);
            ctx.restore();
          }
        }
      }
    }

  // ── Rise ────────────────────────────────────────────────────────────────────
  // All elements slide upward from 60px below into final position, staggered
  } else if (preset === "rise") {
    const RISE_DIST = 60;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Bar rises t=0.04→0.18
    const barP = easeOut(phase(t, 0.04, 0.18), 3);
    const barAlpha = clamp(barP * 3);
    if (barP > 0) {
      const offY = RISE_DIST * (1 - barP);
      ctx.save();
      ctx.globalAlpha = barAlpha;
      ctx.fillStyle = accentColor;
      fillRoundRect(ctx, PAD_X, layout.barY + offY, 56, 4, 2);
      ctx.restore();
    }

    // Headline rises t=0.14→0.38
    const hP = easeOut(phase(t, 0.14, 0.38), 3);
    const hAlpha = clamp(hP * 3);
    if (hP > 0) {
      drawHeadline(ctx, layout, textColor, hAlpha, RISE_DIST * (1 - hP));
    }

    // Bullets rise staggered t=0.36→0.90
    for (let i = 0; i < n; i++) {
      const start = 0.36 + i * (0.48 / n);
      const end = start + 0.18;
      const bP = easeOut(phase(t, start, end), 3);
      const bAlpha = clamp(bP * 3);
      if (bP > 0) {
        drawBullet(ctx, layout, i, accentColor, textColor, bAlpha, 0, RISE_DIST * (1 - bP));
      }
    }

  // ── Pop ─────────────────────────────────────────────────────────────────────
  // Headline fades; each bullet's dot pops in with spring overshoot, text fades alongside
  } else if (preset === "pop") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Bar expands t=0→0.10
    const barP = easeOut(phase(t, 0, 0.10));
    drawBar(ctx, layout, accentColor, barP, clamp(barP * 5));

    // Headline fades in t=0.08→0.30
    const hAlpha = easeOut(phase(t, 0.08, 0.30), 2);
    drawHeadline(ctx, layout, textColor, hAlpha);

    // Bullets pop in staggered t=0.28→0.90
    for (let i = 0; i < n; i++) {
      const start = 0.28 + i * (0.58 / n);
      const end = start + 0.16;
      const p = phase(t, start, end);
      if (p <= 0) continue;
      const dotScale = clamp(easeOutBack(Math.min(p, 1)), 0, 2.5);
      const textAlpha = easeOut(phase(t, start, end + 0.08), 2);
      drawBulletPop(ctx, layout, i, accentColor, textColor, dotScale, textAlpha);
    }

  // ── Wipe ────────────────────────────────────────────────────────────────────
  // A clip rectangle sweeps left-to-right revealing all content at once
  } else if (preset === "wipe") {
    // Full bg first
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Sweep progress: t=0.02→0.80 with easeOutCubic
    const sweepP = easeOut(phase(t, 0.02, 0.80), 3);
    const sweepX = CARD_W * sweepP;

    if (sweepX > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, sweepX, CARD_H);
      ctx.clip();

      // Draw fully-settled content inside the clip
      drawBar(ctx, layout, accentColor);
      drawHeadline(ctx, layout, textColor);
      for (let i = 0; i < n; i++) {
        drawBullet(ctx, layout, i, accentColor, textColor);
      }

      ctx.restore();

      // Bright wipe edge line
      if (sweepP < 1) {
        ctx.save();
        const edgeAlpha = clamp(1 - Math.abs(sweepP - 0.5) * 2.5) * 0.55;
        ctx.globalAlpha = edgeAlpha;
        const grad = ctx.createLinearGradient(sweepX - 20, 0, sweepX + 4, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, "#ffffff");
        ctx.fillStyle = grad;
        ctx.fillRect(sweepX - 20, 0, 24, CARD_H);
        ctx.restore();
      }
    }
  }
}

// ── Recording helpers (same MP4/WebM fallback pattern as visual card) ─────────

async function recordMp4(
  canvas: HTMLCanvasElement,
  durationMs: number,
  draw: (t: number) => void
): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const totalFrames = Math.round((durationMs / 1000) * FPS);
  const frameUsec = Math.round(1_000_000 / FPS);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: canvas.width, height: canvas.height, frameRate: FPS },
    fastStart: false,
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
    error: (e) => console.error("VideoEncoder error:", e),
  });

  videoEncoder.configure({
    codec: "avc1.4d0028",
    width: canvas.width,
    height: canvas.height,
    bitrate: 6_000_000,
    framerate: FPS,
  });

  for (let i = 0; i <= totalFrames; i++) {
    const t = Math.min(1, i / totalFrames);
    draw(t);
    const frame = new VideoFrame(canvas, { timestamp: i * frameUsec });
    videoEncoder.encode(frame, { keyFrame: i === 0 || i % FPS === 0 });
    frame.close();
  }

  await videoEncoder.flush();
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}

async function recordWebM(
  canvas: HTMLCanvasElement,
  durationMs: number,
  draw: (t: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const stream = canvas.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    rec.onerror = (e) => reject(e);
    rec.start(200);
    const startMs = performance.now();
    function tick() {
      const elapsed = performance.now() - startMs;
      const t = Math.min(1, elapsed / durationMs);
      draw(t);
      if (t < 1) { setTimeout(tick, FRAME_MS); } else { draw(1); setTimeout(() => rec.stop(), 800); }
    }
    tick();
  });
}

async function record(
  canvas: HTMLCanvasElement,
  durationMs: number,
  draw: (t: number) => void
): Promise<Blob> {
  if (typeof VideoEncoder !== "undefined") {
    return recordMp4(canvas, durationMs, draw);
  }
  return recordWebM(canvas, durationMs, draw);
}

export async function downloadAnimatedInfographic(
  headline: string,
  bullets: string[],
  topic: string,
  bgColor = DEFAULT_BG,
  accentColor = DEFAULT_ACCENT,
  textColor = DEFAULT_TEXT,
  preset: InfographicAnimPreset = "reveal",
  durationMs?: number
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  const layout = buildInfoLayout(ctx, headline, bullets);
  const dur = durationMs ?? INFOGRAPHIC_BASE_DURATIONS[preset];

  const blob = await record(canvas, dur, (t) => {
    drawFrame(ctx, layout, bgColor, accentColor, textColor, preset, t);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "infographic";
  const ext = blob.type === "video/mp4" ? "mp4" : "webm";
  a.download = `${safeName}-infographic-${preset}.${ext}`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
