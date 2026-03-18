import type { CarouselSlide } from "@workspace/api-client-react";

const CARD_W = 1080;
const CARD_H = 1080;
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const SLIDE_HOLD_MS = 2000;
const SWIPE_MS = 500;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line + (line ? " " : "") + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: CarouselSlide,
  total: number,
  bgColor: string,
  accentColor: string,
  offsetX = 0,
  contentAlpha = 1
) {
  const P = 96;
  const TOP = 240;

  ctx.save();
  ctx.translate(offsetX, 0);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.globalAlpha = contentAlpha;

  ctx.fillStyle = rgba(accentColor, 0.5);
  ctx.font = `800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  ctx.letterSpacing = "5px";
  ctx.fillText(
    `${String(slide.slide).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    P,
    TOP
  );
  ctx.letterSpacing = "0px";

  ctx.fillStyle = accentColor;
  fillRoundRect(ctx, P, TOP + 24, 56, 4, 2);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  wrapText(ctx, slide.title, P, TOP + 100, CARD_W - P * 2, 64);

  ctx.fillStyle = rgba("#ffffff", 0.6);
  ctx.font = `400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  wrapText(ctx, slide.description, P, TOP + 270, CARD_W - P * 2, 42);

  ctx.globalAlpha = 1;
  ctx.restore();
}

function record(
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
      if (t < 1) {
        setTimeout(tick, FRAME_MS);
      } else {
        draw(1);
        setTimeout(() => rec.stop(), 600);
      }
    }
    tick();
  });
}

export async function downloadAnimatedCarousel(
  slides: CarouselSlide[],
  topic: string,
  bgColor: string,
  accentColor: string
): Promise<void> {
  if (!slides.length) return;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  const n = slides.length;
  const segmentMs = SLIDE_HOLD_MS + SWIPE_MS;
  const totalMs = n * SLIDE_HOLD_MS + (n - 1) * SWIPE_MS + 600;

  const blob = await record(canvas, totalMs, (t) => {
    const elapsed = t * totalMs;

    for (let i = 0; i < n; i++) {
      const segStart = i * segmentMs;
      const holdEnd = segStart + SLIDE_HOLD_MS;
      const swipeEnd = holdEnd + SWIPE_MS;

      if (elapsed >= segStart && elapsed < holdEnd) {
        const holdT = clamp((elapsed - segStart) / SLIDE_HOLD_MS);
        const fadeIn = i === 0 ? easeOut(clamp(holdT * 4)) : 1;
        drawSlide(ctx, slides[i], n, bgColor, accentColor, 0, fadeIn);
        return;
      }

      if (elapsed >= holdEnd && elapsed < swipeEnd && i < n - 1) {
        const swipeT = easeOut(clamp((elapsed - holdEnd) / SWIPE_MS), 4);
        const currentOffsetX = -CARD_W * swipeT;
        const nextOffsetX = CARD_W * (1 - swipeT);
        drawSlide(ctx, slides[i], n, bgColor, accentColor, currentOffsetX, 1);
        drawSlide(ctx, slides[i + 1], n, bgColor, accentColor, nextOffsetX, 1);
        return;
      }
    }

    drawSlide(ctx, slides[n - 1], n, bgColor, accentColor, 0, 1);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "carousel";
  a.download = `${safeName}-carousel.webm`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
