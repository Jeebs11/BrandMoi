import type { ComparisonRow, ComparisonStatus, ComparisonTable, ProofPointComparisonRow, ApplicableSource } from "@/lib/api";

// How well your CV, BrandMoi profile and LinkedIn tell the same story. Rows
// that only one source can speak to, or that lack data, don't count either way.
const WEIGHT: Partial<Record<ComparisonStatus, number>> = {
  all_agree: 1,
  cv_brandmoi_agree_linkedin_differs: 0.5,
  cv_linkedin_agree_brandmoi_stale: 0.5,
  brandmoi_linkedin_agree_cv_differs: 0.5,
  all_differ: 0,
};

export function coherenceScore(table: ComparisonTable): { score: number; counted: number } | null {
  const scored = table.rows
    .map((row) => WEIGHT[row.status])
    .filter((w): w is number => w !== undefined);
  if (scored.length === 0) return null;
  return {
    score: Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100),
    counted: scored.length,
  };
}

/** Which sources disagree with the other two on this row. */
export function outliers(status: ComparisonStatus): ApplicableSource[] {
  switch (status) {
    case "cv_brandmoi_agree_linkedin_differs": return ["linkedin"];
    case "cv_linkedin_agree_brandmoi_stale": return ["brandmoi"];
    case "brandmoi_linkedin_agree_cv_differs": return ["cv"];
    case "all_differ": return ["cv", "brandmoi", "linkedin"];
    default: return [];
  }
}

export function isProofPointRow(row: ComparisonRow | ProofPointComparisonRow): row is ProofPointComparisonRow {
  return row.rowKey === "proof_points";
}
