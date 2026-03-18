import { toPng } from "html-to-image";

const DEFAULT_BG = "#0f172a";
const DEFAULT_ACCENT = "#6366f1";

function buildCardEl(
  quoteText: string,
  bgColor: string = DEFAULT_BG,
  accentColor: string = DEFAULT_ACCENT
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
    "align-items:flex-start",
    "padding:100px 104px",
    "box-sizing:border-box",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  ].join(";");

  // Large opening quote mark
  const quote = document.createElement("div");
  quote.style.cssText = `color:${accentColor};font-size:120px;line-height:1;font-weight:800;margin-bottom:8px;margin-left:-8px`;
  quote.textContent = "\u201C";

  // Accent bar
  const bar = document.createElement("div");
  bar.style.cssText = `width:56px;height:4px;background:${accentColor};border-radius:2px;margin-bottom:48px`;

  // Quote text
  const body = document.createElement("div");
  body.style.cssText = "color:#ffffff;font-size:56px;font-weight:700;line-height:1.18;word-break:break-word;letter-spacing:-0.5px";
  body.textContent = quoteText;

  el.appendChild(quote);
  el.appendChild(bar);
  el.appendChild(body);

  return el;
}

export async function downloadVisualCard(
  quoteText: string,
  topic: string,
  bgColor: string = DEFAULT_BG,
  accentColor: string = DEFAULT_ACCENT
): Promise<void> {
  const el = buildCardEl(quoteText, bgColor, accentColor);
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;top:-9999px;left:-9999px;overflow:hidden;width:1080px;height:1080px;";
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  try {
    const dataUrl = await toPng(el, { width: 1080, height: 1080, pixelRatio: 1, skipFonts: true });
    const a = document.createElement("a");
    const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "quote-card";
    a.download = `${safeName}-quote-card.png`;
    a.href = dataUrl;
    a.click();
  } finally {
    document.body.removeChild(wrapper);
  }
}
