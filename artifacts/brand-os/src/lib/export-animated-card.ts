export type CardAnimPreset = "typewriter" | "fade" | "slide";

const CARD_W = 1080;
const CARD_H = 1080;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
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
  return currentY;
}

function drawCardContent(
  ctx: CanvasRenderingContext2D,
  quoteText: string,
  accentColor: string
) {
  const PH = 104;
  const TOP = 300;

  ctx.fillStyle = accentColor;
  ctx.font = `800 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  ctx.fillText("\u201C", PH - 8, TOP);

  ctx.fillStyle = accentColor;
  fillRoundRect(ctx, PH, TOP + 48, 56, 4, 2);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
  wrapText(ctx, quoteText, PH, TOP + 145, CARD_W - PH * 2, 72);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  quoteText: string,
  bgColor: string,
  accentColor: string,
  preset: CardAnimPreset,
  t: number
) {
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  if (preset === "typewriter") {
    const bgAlpha = easeOut(phase(t, 0, 0.1));
    const qmAlpha = easeOut(phase(t, 0.1, 0.28));
    const barProg = easeOut(phase(t, 0.22, 0.42));
    const textProg = easeOut(phase(t, 0.38, 0.90));

    ctx.globalAlpha = bgAlpha;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.globalAlpha = 1;

    const PH = 104;
    const TOP = 300;

    ctx.globalAlpha = qmAlpha;
    ctx.fillStyle = accentColor;
    ctx.font = `800 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    ctx.fillText("\u201C", PH - 8, TOP);

    ctx.globalAlpha = clamp(barProg * 2);
    ctx.fillStyle = accentColor;
    fillRoundRect(ctx, PH, TOP + 48, 56 * barProg, 4, 2);

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
    const chars = Math.floor(textProg * quoteText.length);
    wrapText(ctx, quoteText.slice(0, chars), PH, TOP + 145, CARD_W - PH * 2, 72);

  } else if (preset === "fade") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const contentAlpha = easeOut(phase(t, 0, 0.75), 2);
    const scale = 0.95 + 0.05 * easeOut(phase(t, 0, 0.75), 2);

    ctx.save();
    ctx.globalAlpha = contentAlpha;
    ctx.translate(CARD_W / 2, CARD_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_W / 2, -CARD_H / 2);
    drawCardContent(ctx, quoteText, accentColor);
    ctx.restore();

  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const slideP = easeOut(phase(t, 0, 0.55), 4);
    const alpha = easeOut(phase(t, 0, 0.3), 2);
    const offsetY = 140 * (1 - slideP);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, offsetY);
    drawCardContent(ctx, quoteText, accentColor);
    ctx.restore();
  }
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

export async function downloadAnimatedCard(
  quoteText: string,
  topic: string,
  bgColor: string,
  accentColor: string,
  preset: CardAnimPreset
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  const durationMs =
    preset === "typewriter" ? 4500 :
    preset === "fade" ? 3000 :
    2500;

  const blob = await record(canvas, durationMs, (t) => {
    drawFrame(ctx, quoteText, bgColor, accentColor, preset, t);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "quote-card";
  a.download = `${safeName}-${preset}.webm`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
