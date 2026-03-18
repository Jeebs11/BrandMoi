import { toPng } from "html-to-image";

const DEFAULT_BG = "#1e1b4b";
const DEFAULT_BG2 = "#312e81";
const DEFAULT_BG3 = "#4338ca";
const DEFAULT_ACCENT = "#818cf8";

function buildCardEl(
  visualText: string,
  bgColor?: string,
  accentColor?: string
): HTMLDivElement {
  const lines = visualText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const headline = lines[0] ?? visualText;
  const rest = lines.slice(1, 4).join(". ") + (lines.length > 1 ? "." : "");

  const bg = bgColor
    ? `linear-gradient(135deg,${bgColor} 0%,${bgColor}cc 50%,${bgColor}99 100%)`
    : `linear-gradient(135deg,${DEFAULT_BG} 0%,${DEFAULT_BG2} 50%,${DEFAULT_BG3} 100%)`;
  const accent = accentColor ?? DEFAULT_ACCENT;

  const el = document.createElement("div");
  // IMPORTANT: no position/top/left here — those go on the wrapper so html-to-image captures correctly
  el.style.cssText = [
    "width:1080px",
    "height:1080px",
    `background:${bg}`,
    "display:flex",
    "flex-direction:column",
    "justify-content:center",
    "align-items:flex-start",
    "padding:96px",
    "box-sizing:border-box",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  ].join(";");

  const label = document.createElement("div");
  label.style.cssText = `color:${accent}99;font-size:12px;font-weight:800;letter-spacing:6px;text-transform:uppercase;margin-bottom:40px`;
  label.textContent = "VISUAL BRIEF";

  const accentBar = document.createElement("div");
  accentBar.style.cssText = `width:56px;height:4px;background:${accent};border-radius:2px;margin-bottom:48px`;

  const h = document.createElement("div");
  h.style.cssText = "color:#ffffff;font-size:50px;font-weight:800;line-height:1.15;margin-bottom:32px;word-break:break-word";
  h.textContent = headline;

  el.appendChild(label);
  el.appendChild(accentBar);
  el.appendChild(h);

  if (rest) {
    const body = document.createElement("div");
    body.style.cssText = "color:rgba(255,255,255,0.65);font-size:24px;line-height:1.65;word-break:break-word";
    body.textContent = rest;
    el.appendChild(body);
  }

  return el;
}

export async function downloadVisualCard(
  visualText: string,
  topic: string,
  bgColor?: string,
  accentColor?: string
): Promise<void> {
  const el = buildCardEl(visualText, bgColor, accentColor);
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;top:-9999px;left:-9999px;overflow:hidden;width:1080px;height:1080px;";
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  try {
    const dataUrl = await toPng(el, { width: 1080, height: 1080, pixelRatio: 1, skipFonts: true });
    const a = document.createElement("a");
    const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "visual-brief";
    a.download = `${safeName}-visual.png`;
    a.href = dataUrl;
    a.click();
  } finally {
    document.body.removeChild(wrapper);
  }
}
