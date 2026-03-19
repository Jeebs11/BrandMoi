import { toPng, toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import type { CarouselSlide } from "@workspace/api-client-react";

const DEFAULT_BG = "#0f172a";
const DEFAULT_ACCENT = "#6366f1";
const DEFAULT_TEXT = "#ffffff";

const SIZE_LIMIT_BYTES = 95 * 1024 * 1024;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildSlideEl(
  slide: CarouselSlide,
  total: number,
  bgColor: string = DEFAULT_BG,
  accentColor: string = DEFAULT_ACCENT,
  textColor: string = DEFAULT_TEXT
): HTMLDivElement {
  const el = document.createElement("div");
  // IMPORTANT: no position/top/left here — those go on the wrapper so html-to-image captures correctly
  el.style.cssText = [
    "width:1080px",
    "height:1080px",
    `background:${bgColor}`,
    "display:flex",
    "flex-direction:column",
    "justify-content:center",
    "padding:96px",
    "box-sizing:border-box",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  ].join(";");

  const slideNum = document.createElement("div");
  slideNum.style.cssText = `color:${hexToRgba(accentColor, 0.5)};font-size:13px;font-weight:800;letter-spacing:5px;text-transform:uppercase;margin-bottom:36px`;
  slideNum.textContent = `${String(slide.slide).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  const accent = document.createElement("div");
  accent.style.cssText = `width:56px;height:4px;background:${accentColor};border-radius:2px;margin-bottom:44px`;

  const title = document.createElement("div");
  title.style.cssText = `color:${textColor};font-size:52px;font-weight:800;line-height:1.12;margin-bottom:32px;word-break:break-word`;
  title.textContent = slide.title;

  const desc = document.createElement("div");
  desc.style.cssText = `color:${hexToRgba(textColor, 0.6)};font-size:24px;line-height:1.65;word-break:break-word`;
  desc.textContent = slide.description;

  el.appendChild(slideNum);
  el.appendChild(accent);
  el.appendChild(title);
  el.appendChild(desc);
  return el;
}

function createWrapper(): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;top:-9999px;left:-9999px;overflow:hidden;width:1080px;height:1080px;";
  return wrapper;
}

async function renderSlidesAsJpeg(
  slides: CarouselSlide[],
  quality: number,
  bgColor: string,
  accentColor: string,
  textColor: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const dataUrls: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const el = buildSlideEl(slides[i], slides.length, bgColor, accentColor, textColor);
    const wrapper = createWrapper();
    wrapper.appendChild(el);
    document.body.appendChild(wrapper);
    try {
      const dataUrl = await toJpeg(el, { width: 1080, height: 1080, pixelRatio: 2, skipFonts: true, quality });
      dataUrls.push(dataUrl);
    } finally {
      document.body.removeChild(wrapper);
    }
  }
  return dataUrls;
}

function buildPdf(dataUrls: string[]): jsPDF {
  const pdf = new jsPDF({ orientation: "p", unit: "px", format: [1080, 1080] });
  for (let i = 0; i < dataUrls.length; i++) {
    if (i > 0) pdf.addPage([1080, 1080], "p");
    pdf.addImage(dataUrls[i], "JPEG", 0, 0, 1080, 1080);
  }
  return pdf;
}

export async function previewCarouselSlide(
  slide: CarouselSlide,
  total: number,
  bgColor: string = DEFAULT_BG,
  accentColor: string = DEFAULT_ACCENT,
  textColor: string = DEFAULT_TEXT
): Promise<string> {
  const el = buildSlideEl(slide, total, bgColor, accentColor, textColor);
  const wrapper = createWrapper();
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  try {
    return await toPng(el, { width: 1080, height: 1080, pixelRatio: 0.28, skipFonts: true });
  } finally {
    document.body.removeChild(wrapper);
  }
}

export async function downloadCarouselPDF(
  slides: CarouselSlide[],
  topic: string,
  bgColor: string = DEFAULT_BG,
  accentColor: string = DEFAULT_ACCENT,
  textColor: string = DEFAULT_TEXT,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const QUALITY_STEPS = [0.90, 0.85, 0.75, 0.65, 0.55];

  // Keep the last candidate so we never need an extra render pass after exhausting steps
  let pdf: jsPDF | null = null;

  for (const quality of QUALITY_STEPS) {
    const dataUrls = await renderSlidesAsJpeg(slides, quality, bgColor, accentColor, textColor, onProgress);
    pdf = buildPdf(dataUrls);
    const sizeBytes = pdf.output("arraybuffer").byteLength;

    if (sizeBytes <= SIZE_LIMIT_BYTES) break;
    // Still too large — try lower quality, but keep this pdf as the fallback candidate
  }

  // pdf is always non-null here — QUALITY_STEPS is non-empty so the loop runs at least once
  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "carousel";
  const dataUri = pdf!.output("datauristring");
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = `${safeName}-carousel.pdf`;
  a.click();
}
