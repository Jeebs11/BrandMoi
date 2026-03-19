export type CardAnimPreset = "typewriter" | "fade" | "slide";

const CARD_W = 1080;
const CARD_H = 1080;
const PAD_H = 104;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

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

// Base durations callers can scale for speed control
export const CARD_BASE_DURATIONS: Record<CardAnimPreset, number> = {
  typewriter: 8000,
  fade: 5500,
  slide: 4500,
};

interface CardLayout {
  quoteBL: number;
  barY: number;
  textBL: number;
  lines: string[];
  lineHeight: number;
  fontSize: number;
}

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

function measureLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string
): string[] {
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line + (line ? " " : "") + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildLayout(ctx: CanvasRenderingContext2D, quoteText: string): CardLayout {
  const maxWidth = CARD_W - PAD_H * 2;
  const QUOTE_CAP_H = 90;
  const QUOTE_TO_BAR = 22;
  const BAR_H = 4;
  const BAR_TO_TEXT = 44;
  const MIN_PAD = 100;

  const candidates = [
    { fontSize: 56, lineHeight: 72 },
    { fontSize: 44, lineHeight: 58 },
    { fontSize: 36, lineHeight: 48 },
    { fontSize: 30, lineHeight: 40 },
  ];

  for (const { fontSize, lineHeight } of candidates) {
    const font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    const lines = measureLines(ctx, quoteText, maxWidth, font);
    const totalH = QUOTE_CAP_H + QUOTE_TO_BAR + BAR_H + BAR_TO_TEXT + lines.length * lineHeight;

    if (totalH <= CARD_H - MIN_PAD * 2 || fontSize === 30) {
      const blockTop = Math.max(MIN_PAD, (CARD_H - totalH) / 2 - 20);
      return {
        quoteBL: blockTop + QUOTE_CAP_H,
        barY: blockTop + QUOTE_CAP_H + QUOTE_TO_BAR,
        textBL: blockTop + QUOTE_CAP_H + QUOTE_TO_BAR + BAR_H + BAR_TO_TEXT,
        lines,
        lineHeight,
        fontSize,
      };
    }
  }

  return { quoteBL: 370, barY: 394, textBL: 444, lines: [quoteText.slice(0, 60)], lineHeight: 72, fontSize: 56 };
}

function drawQuoteMark(ctx: CanvasRenderingContext2D, layout: CardLayout, accentColor: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = accentColor;
  ctx.font = `800 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  ctx.fillText("\u201C", PAD_H - 8, layout.quoteBL);
  ctx.restore();
}

function drawClosingQuoteMark(ctx: CanvasRenderingContext2D, accentColor: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = accentColor;
  ctx.font = `800 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText("\u201D", CARD_W - PAD_H + 8, CARD_H - 80);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawBar(ctx: CanvasRenderingContext2D, layout: CardLayout, accentColor: string, progress = 1, alpha = 1) {
  if (progress <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = accentColor;
  fillRoundRect(ctx, PAD_H, layout.barY, 56 * progress, 4, 2);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, layout: CardLayout, textProgress = 1, alpha = 1, textColor = "#ffffff") {
  const { lines, lineHeight, textBL, fontSize } = layout;
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const revealed = Math.floor(textProgress * totalChars);
  let remaining = revealed;
  let y = textBL;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;

  for (const line of lines) {
    if (remaining <= 0) break;
    ctx.fillText(line.slice(0, remaining), PAD_H, y);
    remaining -= line.length;
    y += lineHeight;
  }
  ctx.restore();
}

function drawFullContent(ctx: CanvasRenderingContext2D, layout: CardLayout, accentColor: string, alpha = 1, textColor = "#ffffff") {
  drawQuoteMark(ctx, layout, accentColor, alpha);
  drawBar(ctx, layout, accentColor, 1, alpha);
  drawText(ctx, layout, 1, alpha, textColor);
  drawClosingQuoteMark(ctx, accentColor, alpha);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  layout: CardLayout,
  bgColor: string,
  accentColor: string,
  preset: CardAnimPreset,
  t: number,
  textColor = "#ffffff"
) {
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  if (preset === "typewriter") {
    const bgAlpha = easeOut(phase(t, 0, 0.08));
    const qmAlpha = easeOut(phase(t, 0.08, 0.22));
    const barProg = easeOut(phase(t, 0.18, 0.36));
    const textProg = phase(t, 0.33, 0.93); // linear so reading speed stays constant
    const closeAlpha = easeOut(phase(t, 0.91, 1.0));

    ctx.globalAlpha = bgAlpha;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.globalAlpha = 1;

    drawQuoteMark(ctx, layout, accentColor, qmAlpha);
    drawBar(ctx, layout, accentColor, barProg, clamp(barProg * 3));
    drawText(ctx, layout, textProg, 1, textColor);
    drawClosingQuoteMark(ctx, accentColor, closeAlpha);

  } else if (preset === "fade") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const alpha = easeOut(phase(t, 0, 0.68), 2);
    const scale = 0.95 + 0.05 * easeOut(phase(t, 0, 0.68), 2);

    ctx.save();
    ctx.translate(CARD_W / 2, CARD_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_W / 2, -CARD_H / 2);
    drawFullContent(ctx, layout, accentColor, alpha, textColor);
    ctx.restore();

  } else { // slide
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const slideP = easeOut(phase(t, 0, 0.52), 4);
    const alpha = easeOut(phase(t, 0, 0.28), 2);
    const offsetY = 130 * (1 - slideP);

    ctx.save();
    ctx.translate(0, offsetY);
    drawFullContent(ctx, layout, accentColor, alpha, textColor);
    ctx.restore();
  }
}


export async function downloadAnimatedCard(
  quoteText: string,
  topic: string,
  bgColor: string,
  accentColor: string,
  preset: CardAnimPreset,
  textColor = "#ffffff",
  durationMs?: number
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  const layout = buildLayout(ctx, quoteText);
  const dur = durationMs ?? CARD_BASE_DURATIONS[preset];

  const blob = await record(canvas, dur, (t) => {
    drawFrame(ctx, layout, bgColor, accentColor, preset, t, textColor);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "quote-card";
  const ext = blob.type === "video/mp4" ? "mp4" : "webm";
  a.download = `${safeName}-${preset}.${ext}`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
