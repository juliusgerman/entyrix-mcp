/**
 * Financial statement rows arrive from the API in CENTS. The tools that serve
 * them promised EUR.
 *
 * Measured 2026-08-12 end-to-end: `get_financials` for SLOVNAFT returned
 * `turnover: 556867400000` under a description reading "All amounts in EUR".
 * The company's 2024 revenue is 5.57 billion EUR, so a model reading that field
 * reports 556 billion — a hundredfold error, delivered as a plain number with
 * nothing to signal it.
 *
 * Worse than the error itself was the inconsistency: `advanced_search` and
 * `list_rankings` divide correctly (`turnoverEur`), these two did not. An agent
 * comparing one company's financials against the ranking it appears in got
 * figures 100x apart for the same company and had no way to tell which was
 * wrong.
 *
 * SCOPE IS DELIBERATELY NARROW. Only the fields below are converted, because
 * only those were measured against the database. The rest of the company
 * envelope is left alone on purpose:
 *
 *   publicContractsTotalCur   already EUR (cross-checked against find_suppliers)
 *   taxDebtAmountCents        self-describing name, left as-is
 *   solvencySignals.*Cents    self-describing names, left as-is
 *   roa / roe                 ratios, not money — converting them would be a
 *                             new bug of exactly the kind this file fixes
 *
 * Guessing at a field's unit is how the original defect happened. If a new
 * money field appears, measure it against `financial_statements` before adding
 * it here.
 */

/** Fields inside a financial-statement row that the API expresses in cents. */
const CENT_FIELDS = ["turnover", "totalAssets", "equity", "totalDebt", "profit", "ebitda"] as const;

function centsToEur(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "number") return v / 100;
  // bigint-ish strings: the API sends numbers today, but a widening to string
  // must not silently pass the raw cents through.
  if (typeof v === "string" && /^-?\d+$/.test(v)) return Number(v) / 100;
  return v;
}

/**
 * Convert one financial-statement row to EUR, leaving every non-money field
 * untouched and stamping the unit so the answer cannot be misread again.
 */
export function financialRowToEur(row: unknown): unknown {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const f of CENT_FIELDS) {
    if (f in out) out[f] = centsToEur(out[f]);
  }
  out.unit = "EUR";
  return out;
}

export function financialRowsToEur(rows: unknown): unknown[] {
  return Array.isArray(rows) ? rows.map(financialRowToEur) : [];
}
