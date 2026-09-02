export type BrandClosingMode = "always" | "smart" | "never";
export type BrandClosingStyle = "signature" | "follow" | "expert" | "custom";

export type BrandClosingApplication = {
  post: string;
  applied: boolean;
};

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function hasNaturalClosing(post: string): boolean {
  const lastParagraph = normalizeLineEndings(post).split(/\n\s*\n/).pop() ?? "";
  const lastLine = lastParagraph.split("\n").map((line) => line.trim()).filter(Boolean).pop() ?? "";
  return /[?]$/.test(lastLine)
    || /^(follow|connect|comment|reply|share|send me|dm me|message me|what do you think|which one)/i.test(lastLine);
}

export function applyBrandClosing(
  post: string,
  mode: BrandClosingMode,
  closingText: string,
): BrandClosingApplication {
  const cleanPost = post.trimEnd();
  const cleanClosing = normalizeLineEndings(closingText);
  if (!cleanPost || !cleanClosing || cleanPost.toLocaleLowerCase().endsWith(cleanClosing.toLocaleLowerCase())) {
    return { post: cleanPost, applied: false };
  }
  if (mode === "never" || (mode === "smart" && hasNaturalClosing(cleanPost))) {
    return { post: cleanPost, applied: false };
  }
  return { post: `${cleanPost}\n\n${cleanClosing}`, applied: true };
}

export function removeBrandClosing(post: string, closingText: string): string {
  const cleanPost = post.trimEnd();
  const cleanClosing = normalizeLineEndings(closingText);
  if (!cleanClosing || !cleanPost.toLocaleLowerCase().endsWith(cleanClosing.toLocaleLowerCase())) {
    return cleanPost;
  }
  return cleanPost.slice(0, cleanPost.length - cleanClosing.length).trimEnd();
}