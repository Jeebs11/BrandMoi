export type IllustrationAnimPreset = "draw" | "reveal" | "pop";

const CARD_W = 1080;
const CARD_H = 1350;
const ILLUS_H = 918; // top 68%
const FPS = 30;
const FRAME_MS = 1000 / FPS;

export const ILLUS_BASE_DURATIONS: Record<IllustrationAnimPreset, number> = {
  draw: 7000,
  reveal: 4500,
  pop: 5000,
};

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}
function phase(t: number, start: number, end: number): number {
  return clamp((t - start) / (end - start));
}
function easeOut(t: number, exp = 3): number {
  return 1 - Math.pow(1 - t, exp);
}
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

async function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64}`;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number
): void {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  font: string
): string[] {
  ctx.font = font;
  const paragraphs = text.split(/\n+/);
  const allLines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxW && line) {
        allLines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) allLines.push(line);
  }
  return allLines;
}

interface CaptionLayout {
  lines: string[];
  fontSize: number;
  lineH: number;
  startY: number;
  dividerY: number;
}

const CAPTION_PAD_X = 80;

function buildCaptionLayout(ctx: CanvasRenderingContext2D, caption: string): CaptionLayout {
  const maxW = CARD_W - CAPTION_PAD_X * 2;
  const availH = CARD_H - ILLUS_H;
  const candidates = [
    { fontSize: 42, lineH: 58 },
    { fontSize: 38, lineH: 52 },
    { fontSize: 34, lineH: 47 },
    { fontSize: 30, lineH: 42 },
    { fontSize: 26, lineH: 37 },
  ];

  for (const { fontSize, lineH } of candidates) {
    const font = `400 ${fontSize}px Georgia, "Times New Roman", serif`;
    const lines = wrapCaption(ctx, caption, maxW, font);
    const textH = lines.length * lineH;
    const totalBlock = 2 + 36 + textH;
    if (totalBlock + 80 <= availH || fontSize === 26) {
      const blockTop = ILLUS_H + (availH - totalBlock) / 2 - 8;
      const dividerY = Math.max(ILLUS_H + 40, blockTop);
      const startY = dividerY + 2 + 36 + fontSize;
      return { lines, fontSize, lineH, startY, dividerY };
    }
  }

  const font = `400 26px Georgia, "Times New Roman", serif`;
  const lines = wrapCaption(ctx, caption, maxW, font);
  return { lines, fontSize: 26, lineH: 37, startY: ILLUS_H + 120, dividerY: ILLUS_H + 52 };
}

function drawCaptionBlock(
  ctx: CanvasRenderingContext2D,
  layout: CaptionLayout,
  dividerAlpha: number,
  textAlpha: number,
  charProgress: number
): void {
  const { lines, fontSize, lineH, startY, dividerY } = layout;

  ctx.save();
  ctx.globalAlpha = dividerAlpha;
  ctx.fillStyle = "#444444";
  ctx.fillRect((CARD_W - 48) / 2, dividerY, 48, 2);
  ctx.restore();

  if (textAlpha <= 0) return;

  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const revealedChars = Math.floor(charProgress * totalChars);
  let remaining = revealedChars;
  let y = startY;

  ctx.save();
  ctx.globalAlpha = textAlpha;
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `400 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  for (const line of lines) {
    if (remaining <= 0) break;
    ctx.fillText(line.slice(0, remaining), CARD_W / 2, y);
    remaining -= line.length;
    y += lineH;
  }
  ctx.textAlign = "left";
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  layout: CaptionLayout,
  preset: IllustrationAnimPreset,
  t: number
): void {
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  if (preset === "draw") {
    const wipeP = easeOut(phase(t, 0, 0.60), 2);
    const clipW = CARD_W * wipeP;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clipW, ILLUS_H);
    ctx.clip();
    drawImageCover(ctx, img, 0, 0, CARD_W, ILLUS_H);
    ctx.restore();

    const divAlpha = easeOut(phase(t, 0.58, 0.66), 2);
    const charProg = phase(t, 0.65, 0.97);
    const textAlpha = charProg > 0 ? 1 : 0;
    drawCaptionBlock(ctx, layout, divAlpha, textAlpha, charProg);

  } else if (preset === "reveal") {
    const illP = easeOut(phase(t, 0, 0.70), 2);
    const scale = 1.0 + 0.03 * (1 - illP);

    ctx.save();
    ctx.globalAlpha = illP;
    ctx.translate(CARD_W / 2, ILLUS_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_W / 2, -ILLUS_H / 2);
    drawImageCover(ctx, img, 0, 0, CARD_W, ILLUS_H);
    ctx.restore();

    const capP = easeOut(phase(t, 0.58, 1.0), 2);
    const offsetY = 40 * (1 - capP);
    ctx.save();
    ctx.translate(0, offsetY);
    drawCaptionBlock(ctx, layout, capP, capP, 1);
    ctx.restore();

  } else {
    const popP = easeOutBack(clamp(phase(t, 0, 0.55)));
    const scale = 0.88 + 0.12 * popP;

    ctx.save();
    ctx.translate(CARD_W / 2, ILLUS_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_W / 2, -ILLUS_H / 2);
    ctx.beginPath();
    ctx.rect(-CARD_W, -CARD_H, CARD_W * 3, CARD_H + ILLUS_H + CARD_H);
    ctx.clip();
    drawImageCover(ctx, img, 0, 0, CARD_W, ILLUS_H);
    ctx.restore();

    const capAlpha = easeOut(phase(t, 0.45, 0.88), 2);
    drawCaptionBlock(ctx, layout, capAlpha, capAlpha, 1);
  }
}

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
    error: (e) => console.error("[illus-export] VideoEncoder error:", e),
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
      if (t < 1) {
        setTimeout(tick, FRAME_MS);
      } else {
        draw(1);
        setTimeout(() => rec.stop(), 800);
      }
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

export async function previewIllustrationCard(
  imageBase64: string,
  caption: string
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(imageBase64);
  const layout = buildCaptionLayout(ctx, caption);
  drawFrame(ctx, img, layout, "reveal", 1);
  return canvas.toDataURL("image/png");
}

export async function downloadIllustrationCard(
  imageBase64: string,
  caption: string,
  filename = "illustration-card"
): Promise<void> {
  const url = await previewIllustrationCard(imageBase64, caption);
  const a = document.createElement("a");
  a.download = `${filename}.png`;
  a.href = url;
  a.click();
}

export async function downloadAnimatedIllustration(
  imageBase64: string,
  caption: string,
  preset: IllustrationAnimPreset,
  filename = "illustration"
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(imageBase64);
  const layout = buildCaptionLayout(ctx, caption);
  const dur = ILLUS_BASE_DURATIONS[preset];

  const blob = await record(canvas, dur, (t) => {
    drawFrame(ctx, img, layout, preset, t);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ext = blob.type === "video/mp4" ? "mp4" : "webm";
  a.download = `${filename}-${preset}.${ext}`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}
