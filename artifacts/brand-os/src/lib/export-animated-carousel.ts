import type { CarouselSlide } from "@workspace/api-client-react";

const CARD_W = 1080;
const CARD_H = 1080;
const PAD = 96;
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

export type CarouselAnimPreset = "swipe" | "fade" | "zoom";

export const CAROUSEL_PRESET_DURATIONS: Record<CarouselAnimPreset, { holdMs: number; transMs: number }> = {
  swipe: { holdMs: 3000, transMs: 600 },
  fade:  { holdMs: 3000, transMs: 800 },
  zoom:  { holdMs: 3500, transMs: 500 },
};

// Kept for backward-compat callers
export const CAROUSEL_BASE_HOLD_MS = 3000;
export const CAROUSEL_BASE_SWIPE_MS = 600;

interface SlideLayout {
  slideNumBL: number;
  barY: number;
  titleBL: number;
  titleLines: string[];
  titleLineHeight: number;
  titleFontSize: number;
  descBL: number;
  descLines: string[];
  descLineHeight: number;
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildSlideLayout(ctx: CanvasRenderingContext2D, slide: CarouselSlide): SlideLayout {
  const maxWidth = CARD_W - PAD * 2;
  const MIN_PAD = 90;

  const titleSizes = [
    { fontSize: 52, lineHeight: 64 },
    { fontSize: 40, lineHeight: 52 },
    { fontSize: 32, lineHeight: 44 },
  ];

  const DESC_FONT = `400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  const DESC_LINE_H = 42;
  const descLines = measureLines(ctx, slide.description ?? "", maxWidth, DESC_FONT);

  const SLIDE_NUM_H = 12;   // visual cap height at 13px
  const NUM_TO_BAR = 14;
  const BAR_H = 4;
  const BAR_TO_TITLE = 44;
  const TITLE_TO_DESC = 36;

  for (const { fontSize, lineHeight } of titleSizes) {
    const titleFont = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    const titleLines = measureLines(ctx, slide.title, maxWidth, titleFont);

    const titleH = titleLines.length * lineHeight;
    const descH = descLines.length * DESC_LINE_H;
    const totalH =
      SLIDE_NUM_H + NUM_TO_BAR + BAR_H + BAR_TO_TITLE + titleH + TITLE_TO_DESC + descH;

    if (totalH <= CARD_H - MIN_PAD * 2 || fontSize === 32) {
      const blockTop = Math.max(MIN_PAD, (CARD_H - totalH) / 2 - 20);
      const slideNumBL = blockTop + SLIDE_NUM_H;
      const barY = slideNumBL + NUM_TO_BAR;
      const titleBL = barY + BAR_H + BAR_TO_TITLE;
      const descBL = titleBL + titleH + TITLE_TO_DESC;

      return {
        slideNumBL,
        barY,
        titleBL,
        titleLines,
        titleLineHeight: lineHeight,
        titleFontSize: fontSize,
        descBL,
        descLines,
        descLineHeight: DESC_LINE_H,
      };
    }
  }

  return {
    slideNumBL: 280, barY: 306, titleBL: 354,
    titleLines: [slide.title.slice(0, 40)], titleLineHeight: 64, titleFontSize: 52,
    descBL: 500, descLines: [(slide.description ?? "").slice(0, 80)], descLineHeight: 42,
  };
}

function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: CarouselSlide,
  total: number,
  layout: SlideLayout,
  bgColor: string,
  accentColor: string,
  offsetX = 0,
  contentAlpha = 1,
  textColor = "#ffffff",
  drawBg = true
) {
  ctx.save();
  ctx.translate(offsetX, 0);

  if (drawBg) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  ctx.globalAlpha = contentAlpha;

  // Slide number counter
  ctx.fillStyle = rgba(accentColor, 0.5);
  ctx.font = `800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  ctx.letterSpacing = "5px";
  ctx.fillText(
    `${String(slide.slide).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    PAD,
    layout.slideNumBL
  );
  ctx.letterSpacing = "0px";

  // Accent bar
  ctx.fillStyle = accentColor;
  fillRoundRect(ctx, PAD, layout.barY, 56, 4, 2);

  // Title
  ctx.fillStyle = textColor;
  ctx.font = `800 ${layout.titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  let y = layout.titleBL;
  for (const line of layout.titleLines) {
    ctx.fillText(line, PAD, y);
    y += layout.titleLineHeight;
  }

  // Description
  ctx.fillStyle = rgba(textColor, 0.6);
  ctx.font = `400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  y = layout.descBL;
  for (const line of layout.descLines) {
    ctx.fillText(line, PAD, y);
    y += layout.descLineHeight;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

export async function downloadAnimatedCarousel(
  slides: CarouselSlide[],
  topic: string,
  bgColor: string,
  accentColor: string,
  textColor = "#ffffff",
  preset: CarouselAnimPreset = "swipe",
  holdMs?: number,
  transMs?: number
): Promise<void> {
  if (!slides.length) return;

  const durations = CAROUSEL_PRESET_DURATIONS[preset];
  const _holdMs = holdMs ?? durations.holdMs;
  const _transMs = transMs ?? durations.transMs;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  const layouts = slides.map((s) => buildSlideLayout(ctx, s));

  const n = slides.length;
  const segmentMs = _holdMs + _transMs;
  const totalMs = n * _holdMs + (n - 1) * _transMs + 800;

  const blob = await record(canvas, totalMs, (t) => {
    const elapsed = t * totalMs;

    for (let i = 0; i < n; i++) {
      const segStart = i * segmentMs;
      const holdEnd = segStart + _holdMs;
      const transEnd = holdEnd + _transMs;

      if (elapsed >= segStart && elapsed < holdEnd) {
        const holdT = clamp((elapsed - segStart) / _holdMs);

        if (preset === "zoom") {
          // Slow zoom-in (Ken Burns): scale from 1.0 → 1.06 over the hold
          const zoom = 1 + 0.06 * easeOut(holdT, 2);
          const fadeIn = i === 0 ? easeOut(clamp(holdT * 5)) : 1;
          ctx.save();
          ctx.translate(CARD_W / 2, CARD_H / 2);
          ctx.scale(zoom, zoom);
          ctx.translate(-CARD_W / 2, -CARD_H / 2);
          drawSlide(ctx, slides[i], n, layouts[i], bgColor, accentColor, 0, fadeIn, textColor);
          ctx.restore();
        } else {
          const fadeIn = i === 0 ? easeOut(clamp(holdT * 5)) : 1;
          drawSlide(ctx, slides[i], n, layouts[i], bgColor, accentColor, 0, fadeIn, textColor);
        }
        return;
      }

      if (elapsed >= holdEnd && elapsed < transEnd && i < n - 1) {
        const transT = easeOut(clamp((elapsed - holdEnd) / _transMs), 4);

        if (preset === "swipe") {
          drawSlide(ctx, slides[i],     n, layouts[i],     bgColor, accentColor, -CARD_W * transT,       1, textColor);
          drawSlide(ctx, slides[i + 1], n, layouts[i + 1], bgColor, accentColor,  CARD_W * (1 - transT), 1, textColor);
        } else {
          // Fade and Zoom: cross-fade — draw shared background once, then layer content
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, CARD_W, CARD_H);
          drawSlide(ctx, slides[i],     n, layouts[i],     bgColor, accentColor, 0, 1 - transT, textColor, false);
          drawSlide(ctx, slides[i + 1], n, layouts[i + 1], bgColor, accentColor, 0, transT,     textColor, false);
        }
        return;
      }
    }

    drawSlide(ctx, slides[n - 1], n, layouts[n - 1], bgColor, accentColor, 0, 1, textColor);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "carousel";
  const ext = blob.type === "video/mp4" ? "mp4" : "webm";
  a.download = `${safeName}-carousel.${ext}`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
