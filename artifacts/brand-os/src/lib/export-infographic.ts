import { toPng } from "html-to-image";

const CARD_W = 1080;
const CARD_H = 1080;
const PAD_X = 96;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

export type InfographicAnimPreset = "reveal" | "fade";

export const INFOGRAPHIC_BASE_DURATIONS: Record<InfographicAnimPreset, number> = {
  reveal: 7000,
  fade: 4500,
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
  offsetX = 0
) {
  const bl = layout.bullets[idx];
  ctx.save();
  ctx.globalAlpha = alpha;

  // Dot
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(PAD_X + DOT_R + offsetX, bl.dotCY, DOT_R, 0, Math.PI * 2);
  ctx.fill();

  // Text lines
  ctx.fillStyle = textColor;
  ctx.globalAlpha = alpha * 0.88;
  ctx.font = `500 ${layout.bulletFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  let y = bl.lineY;
  for (const line of bl.lines) {
    ctx.fillText(line, PAD_X + DOT_EFFECTIVE_W + offsetX, y);
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

  if (preset === "fade") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const alpha = easeOut(phase(t, 0, 0.65), 2);
    drawBar(ctx, layout, accentColor, alpha, alpha);
    drawHeadline(ctx, layout, textColor, alpha);
    for (let i = 0; i < n; i++) {
      drawBullet(ctx, layout, i, accentColor, textColor, alpha);
    }
  } else {
    // reveal: bg fades, bar expands, headline slides up, bullets stagger in from left
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
