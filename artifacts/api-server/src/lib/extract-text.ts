export async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mimetype === "application/pdf" || ext === "pdf") {
    // Import from the inner lib path to bypass index.js which tries to read
    // a test file (./test/data/05-versions-space.pdf) relative to process.cwd()
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js") as { default: (buf: Buffer) => Promise<{ text: string }> };
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}
