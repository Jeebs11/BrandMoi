import * as XLSX from "xlsx";

export interface LinkedinAnalyticsData {
  linkedinUrl: string | null;
  linkedinPostDate: string | null;
  impressions: number;
  membersReached: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  linkEngagements: number;
  followersGained: number;
  linkedinFeedback: {
    status: "reported" | "not_reported" | "unknown";
    label: string | null;
    raw: string | null;
    fieldFound: boolean;
  };
  demographics: {
    jobTitles: { value: string; pct: string }[];
    locations: { value: string; pct: string }[];
    seniorities: { value: string; pct: string }[];
    industries: { value: string; pct: string }[];
    companySizes: { value: string; pct: string }[];
    companies: { value: string; pct: string }[];
  };
}

/** Extract a numeric value following a label string in the flat list */
function extractNum(strings: string[], label: string): number {
  const idx = strings.findIndex(s => s?.toLowerCase() === label.toLowerCase());
  if (idx === -1) return 0;
  const raw = strings[idx + 1];
  if (!raw) return 0;
  const n = parseInt(raw.replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

/** Extract a text value following a label string */
function extractStr(strings: string[], label: string): string | null {
  const idx = strings.findIndex(s => s?.toLowerCase() === label.toLowerCase());
  if (idx === -1) return null;
  return strings[idx + 1] ?? null;
}

/**
 * Extract demographic rows from the flat string list starting after a
 * section header. Rows come in pairs: value, pct — until the next known
 * section header or end of list.
 */
const SECTION_HEADERS = new Set([
  "post url", "post date", "post publish time", "post performance",
  "impressions", "members reached", "profile activity",
  "profile viewers from this post", "followers gained from this post",
  "engagement", "social engagements", "reactions", "comments", "reposts",
  "saves", "sends on linkedin", "link engagements",
  "premium custom button engagements", "post viewer demographics",
  "category", "value", "%",
  "job title", "location", "seniority", "company", "industry", "company size",
]);

const FEEDBACK_FIELD_PATTERNS = [
  /\bmember\s+feedback\b/i,
  /\bai[\s-]*(?:generated|written)\s+(?:content|feedback)\b/i,
  /\bcontent\s+feedback\b/i,
  /\bfeedback\s+on\s+(?:this\s+)?post\b/i,
];

const FEEDBACK_VALUE_PATTERNS = [
  /seems\s+like\s+ai\s+slop/i,
  /ai[\s-]*(?:generated|slop|written)/i,
  /no\s+feedback/i,
  /not\s+reported/i,
  /^\s*(?:none|no|0|false)\s*$/i,
];

function isFeedbackField(value: string): boolean {
  return FEEDBACK_FIELD_PATTERNS.some((pattern) => pattern.test(value));
}

function isFeedbackValue(value: string): boolean {
  return FEEDBACK_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function extractLinkedinFeedback(strings: string[]): LinkedinAnalyticsData["linkedinFeedback"] {
  const fieldIndex = strings.findIndex(isFeedbackField);
  if (fieldIndex >= 0) {
    const rawValue = strings[fieldIndex + 1]?.trim() || null;
    if (!rawValue || isFeedbackField(rawValue)) {
      return { status: "not_reported", label: null, raw: rawValue, fieldFound: true };
    }
    if (isFeedbackValue(rawValue)) {
      const negative = /no\s+feedback|not\s+reported|^\s*(?:none|no|0|false)\s*$/i.test(rawValue);
      return {
        status: negative ? "not_reported" : "reported",
        label: negative ? null : rawValue,
        raw: rawValue,
        fieldFound: true,
      };
    }
    return { status: "reported", label: rawValue, raw: rawValue, fieldFound: true };
  }

  // Some exports may put the member-facing message in a value column without
  // repeating a field label. Treat that as reported, but never infer absence.
  const value = strings.find((item) => /seems\s+like\s+ai\s+slop/i.test(item));
  if (value) return { status: "reported", label: value, raw: value, fieldFound: false };

  return { status: "unknown", label: null, raw: null, fieldFound: false };
}

function extractDemoRows(strings: string[], sectionLabel: string): { value: string; pct: string }[] {
  const idx = strings.findIndex(s => s?.toLowerCase() === sectionLabel.toLowerCase());
  if (idx === -1) return [];
  const labelLower = sectionLabel.toLowerCase();
  const rows: { value: string; pct: string }[] = [];
  let i = idx + 1;
  while (i < strings.length) {
    const val = strings[i];
    if (!val) { i++; continue; }
    // LinkedIn repeats the category name on every row in some export formats — skip it
    if (val.toLowerCase() === labelLower) { i++; continue; }
    // Also skip generic column headers like "Category", "Value", "%"
    if (val.toLowerCase() === "category" || val.toLowerCase() === "value" || val === "%") { i++; continue; }
    // Stop at any OTHER section header
    if (SECTION_HEADERS.has(val.toLowerCase())) break;
    const pct = strings[i + 1] ?? "";
    const isPct = pct.includes("%") || pct === "< 1%";
    if (isPct) {
      rows.push({ value: val, pct });
      i += 2;
    } else {
      // No pct on next slot — treat as < 1% row with single value
      rows.push({ value: val, pct: "< 1%" });
      i++;
    }
    if (rows.length >= 20) break;
  }
  return rows;
}

/**
 * Parse a LinkedIn single-post analytics xlsx file buffer and return
 * a structured analytics object.
 */
export function parseLinkedinAnalytics(buffer: Buffer): LinkedinAnalyticsData {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("No sheet found in xlsx");

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];

  // Flatten all non-null cell values into a single ordered list
  const strings: string[] = rows
    .flat()
    .map(v => (v !== null && v !== undefined ? String(v).trim() : ""))
    .filter(Boolean);

  const linkedinUrl = extractStr(strings, "Post URL");
  const linkedinPostDate = extractStr(strings, "Post Date");

  return {
    linkedinUrl,
    linkedinPostDate,
    impressions: extractNum(strings, "Impressions"),
    membersReached: extractNum(strings, "Members reached"),
    reactions: extractNum(strings, "Reactions"),
    comments: extractNum(strings, "Comments"),
    reposts: extractNum(strings, "Reposts"),
    saves: extractNum(strings, "Saves"),
    sends: extractNum(strings, "Sends on LinkedIn"),
    linkEngagements: extractNum(strings, "Link engagements"),
    followersGained: extractNum(strings, "Followers gained from this post"),
    linkedinFeedback: extractLinkedinFeedback(strings),
    demographics: {
      jobTitles: extractDemoRows(strings, "Job title"),
      locations: extractDemoRows(strings, "Location"),
      seniorities: extractDemoRows(strings, "Seniority"),
      industries: extractDemoRows(strings, "Industry"),
      companySizes: extractDemoRows(strings, "Company size"),
      companies: extractDemoRows(strings, "Company"),
    },
  };
}
