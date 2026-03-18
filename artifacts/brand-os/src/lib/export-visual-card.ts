import { toPng } from "html-to-image";

function buildCardEl(visualText: string): HTMLDivElement {
  const lines = visualText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const headline = lines[0] ?? visualText;
  const rest = lines.slice(1, 4).join(". ") + (lines.length > 1 ? "." : "");

  const el = document.createElement("div");
  el.style.cssText = [
    "width:1080px",
    "height:1080px",
    "background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)",
    "display:flex",
    "flex-direction:column",
    "justify-content:center",
    "align-items:flex-start",
    "padding:96px",
    "box-sizing:border-box",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    "position:fixed",
    "top:-9999px",
    "left:-9999px",
    "z-index:-1",
  ].join(";");

  const label = document.createElement("div");
  label.style.cssText =
    "color:rgba(165,180,252,0.8);font-size:12px;font-weight:800;letter-spacing:6px;text-transform:uppercase;margin-bottom:40px";
  label.textContent = "VISUAL BRIEF";

  const accent = document.createElement("div");
  accent.style.cssText =
    "width:56px;height:4px;background:#818cf8;border-radius:2px;margin-bottom:48px";

  const h = document.createElement("div");
  h.style.cssText =
    "color:#ffffff;font-size:50px;font-weight:800;line-height:1.15;margin-bottom:32px;word-break:break-word";
  h.textContent = headline;

  const el2 = document.createElement("div");
  el2.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "flex:1",
  ].join(";");

  el.appendChild(label);
  el.appendChild(accent);
  el.appendChild(h);

  if (rest) {
    const body = document.createElement("div");
    body.style.cssText =
      "color:rgba(199,210,254,0.75);font-size:24px;line-height:1.65;word-break:break-word";
    body.textContent = rest;
    el.appendChild(body);
  }

  return el;
}

export async function downloadVisualCard(visualText: string, topic: string): Promise<void> {
  const el = buildCardEl(visualText);
  document.body.appendChild(el);
  try {
    const dataUrl = await toPng(el, { width: 1080, height: 1080, pixelRatio: 1 });
    const a = document.createElement("a");
    const safeName = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "visual-brief";
    a.download = `${safeName}-visual.png`;
    a.href = dataUrl;
    a.click();
  } finally {
    document.body.removeChild(el);
  }
}
