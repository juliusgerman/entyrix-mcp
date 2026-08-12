/**
 * The hundredfold bug, pinned.
 *
 * These numbers are not invented: 55686740000000 is what
 * `financial_statements.turnover` holds for SLOVNAFT (IČO 31322832) for 2024,
 * and the company's real revenue is 5.57 billion EUR. A regression here does
 * not throw and does not look wrong — it just moves a decimal point in every
 * answer an agent gives about a company's size.
 */
import { describe, it, expect } from "vitest";
import { financialRowToEur, financialRowsToEur } from "../money.js";

const SLOVNAFT_2024 = {
  financialYear: 2024,
  turnover: 556867400000,
  totalAssets: 288929400000,
  equity: 147617200000,
  totalDebt: 141312200000,
  profit: 36596300000,
  ebitda: null,
  roa: 0.126,
  roe: null,
};

describe("financialRowToEur", () => {
  const r = financialRowToEur(SLOVNAFT_2024) as Record<string, unknown>;

  it("converts cents to EUR", () => {
    expect(r.turnover).toBe(5568674000);
    expect(r.profit).toBe(365963000);
    expect(r.totalAssets).toBe(2889294000);
  });

  it("leaves the year alone", () => {
    expect(r.financialYear).toBe(2024);
  });

  it("does NOT touch ratios — roa/roe are not money", () => {
    // Converting these would be the same class of bug in the other direction.
    expect(r.roa).toBe(0.126);
    expect(r.roe).toBeNull();
  });

  it("passes nulls through instead of turning them into 0", () => {
    expect(r.ebitda).toBeNull();
  });

  it("stamps the unit so the value cannot be misread again", () => {
    expect(r.unit).toBe("EUR");
  });

  it("survives a string-encoded bigint without leaking raw cents", () => {
    const s = financialRowToEur({ turnover: "556867400000" }) as Record<string, unknown>;
    expect(s.turnover).toBe(5568674000);
  });

  it("does not invent rows from a non-array", () => {
    expect(financialRowsToEur(undefined)).toEqual([]);
    expect(financialRowsToEur(null)).toEqual([]);
  });

  it("agrees with what advanced_search reports for the same company", () => {
    // VOLKSWAGEN SLOVAKIA: financial_statements.turnover = 1252064400000,
    // advanced_search turnoverEur = 12520644000. Same company, same year — the
    // two surfaces disagreeing by 100x is the defect this guards.
    const vw = financialRowToEur({ turnover: 1252064400000 }) as Record<string, unknown>;
    expect(vw.turnover).toBe(12520644000);
  });
});
