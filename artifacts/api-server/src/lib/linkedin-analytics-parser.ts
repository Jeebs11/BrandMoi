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

function extractDemoRows(strings: string[], sectionLabel: string): { value: string; pct: string }[] {
  const idx = strings.findIndex(s => s?.toLowerCase() === sectionLabel.toLowerCase());
  if (idx === -1) return [];
  const rows: { value: string; pct: string }[] = [];
  let i = idx + 1;
  while (i < strings.length) {
    const val = strings[i];
    if (!val) { i++; continue; }
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
    if (rows.length >= 10) break;
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
