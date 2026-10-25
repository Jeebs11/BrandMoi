import { describe, expect, it } from "vitest";
import { coherenceScore, outliers } from "./profile-coherence";
import type { ComparisonTable } from "./api";

const row = (status: string) => ({ rowKey: "audience", label: "x", applicableSources: [], cv: null, brandmoi: null, linkedin: null, status, statusDetail: "" });
const table = (...statuses: string[]) => ({ generatedAt: "", rows: statuses.map(row) }) as unknown as ComparisonTable;

describe("coherenceScore", () => {
  it("scores agreement and ignores rows with nothing to compare", () => {
    expect(coherenceScore(table("all_agree", "all_agree"))?.score).toBe(100);
    expect(coherenceScore(table("all_agree", "all_differ"))?.score).toBe(50);
    expect(coherenceScore(table("all_agree", "only_one_source", "insufficient_data"))).toEqual({ score: 100, counted: 1 });
    expect(coherenceScore(table("only_one_source"))).toBeNull();
  });

  it("names the outlier", () => {
    expect(outliers("cv_linkedin_agree_brandmoi_stale")).toEqual(["brandmoi"]);
    expect(outliers("all_agree")).toEqual([]);
  });
});
