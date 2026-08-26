import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseLinkedinAnalytics } from "./linkedin-analytics-parser.js";

function workbookBuffer(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Post analytics");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

{
  const parsed = parseLinkedinAnalytics(workbookBuffer([
    ["Post URL", "https://www.linkedin.com/posts/example"],
    ["Post Date", "2026-08-27"],
    ["Impressions", "1,240"],
    ["Members reached", "980"],
    ["Reactions", "62"],
    ["Comments", "8"],
    ["Reposts", "4"],
    ["Saves", "11"],
    ["Member feedback", "Seems like AI slop"],
    ["Job title", "Founder", "42%"],
  ]));

  assert.equal(parsed.impressions, 1240);
  assert.equal(parsed.membersReached, 980);
  assert.equal(parsed.saves, 11);
  assert.deepEqual(parsed.demographics.jobTitles, [{ value: "Founder", pct: "42%" }]);
  assert.deepEqual(parsed.linkedinFeedback, {
    status: "reported",
    label: "Seems like AI slop",
    raw: "Seems like AI slop",
    fieldFound: true,
  });
}

{
  const parsed = parseLinkedinAnalytics(workbookBuffer([
    ["Post URL", "https://www.linkedin.com/posts/minimal"],
    ["Impressions", "0"],
    ["Members reached", "0"],
  ]));

  assert.equal(parsed.impressions, 0);
  assert.equal(parsed.demographics.jobTitles.length, 0);
  assert.equal(parsed.linkedinFeedback.status, "unknown");
  assert.equal(parsed.linkedinFeedback.fieldFound, false);
}

{
  const parsed = parseLinkedinAnalytics(workbookBuffer([
    ["Post performance"],
    ["Member feedback", "No feedback reported"],
    ["Reactions", "3"],
  ]));

  assert.equal(parsed.linkedinFeedback.status, "not_reported");
  assert.equal(parsed.linkedinFeedback.label, null);
}

console.log("linkedin-analytics-parser tests passed");