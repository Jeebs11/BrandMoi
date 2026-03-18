import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { CarouselSlide } from "@workspace/api-client-react";

function buildSlideEl(slide: CarouselSlide, total: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "width:1080px",
    "height:1080px",
    "background:#0f172a",
    "display:flex",
    "flex-direction:column",
    "justify-content:center",
    "padding:96px",
    "box-sizing:border-box",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    "position:fixed",
    "top:-9999px",
    "left:-9999px",
    "z-index:-1",
  ].join(";");

  const slideNum = document.createElement("div");
  slideNum.style.cssText =
    "color:rgba(255,255,255,0.3);font-size:13px;font-weight:800;letter-spacing:5px;text-transform:uppercase;margin-bottom:36px";
  slideNum.textContent = `${String(slide.slide).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  const accent = document.createElement("div");
  accent.style.cssText =
    "width:56px;height:4px;background:#6366f1;border-radius:2px;margin-bottom:44px";

  const title = document.createElement("div");
  title.style.cssText =
    "color:#ffffff;font-size:52px;font-weight:800;line-height:1.12;margin-bottom:32px;word-break:break-word";
  title.textContent = slide.title;

  const desc = document.createElement("div");
  desc.style.cssText =
    "color:rgba(255,255,255,0.6);font-size:24px;line-height:1.65;word-break:break-word";
  desc.textContent = slide.description;

  el.appendChild(slideNum);
  el.appendChild(accent);
  el.appendChild(title);
  el.appendChild(desc);
  return el;
}

export async function downloadCarouselPDF(
  slides: CarouselSlide[],
  topic: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const pdf = new jsPDF({ orientation: "p", unit: "px", format: [1080, 1080] });

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const el = buildSlideEl(slides[i], slides.length);
    document.body.appendChild(el);
    try {
      const dataUrl = await toPng(el, { width: 1080, height: 1080, pixelRatio: 1 });
      if (i > 0) pdf.addPage([1080, 1080], "p");
      pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1080);
    } finally {
      document.body.removeChild(el);
    }
  }

  const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "carousel";
  const dataUri = pdf.output("datauristring");
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = `${safeName}-carousel.pdf`;
  a.click();
}
