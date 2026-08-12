/**
 * Registry-identifier handling for the ico-keyed tools.
 *
 * Every one of them used to do `args.ico.padStart(8, "0")` unconditionally,
 * which is right for a Slovak or Czech IČO and damaging for anything else:
 *
 *   HE17546      (CY) -> "0HE17546"     corrupted, cannot match
 *   357942k      (AT) -> "0357942k"     corrupted, cannot match
 *   0140168-2    (FI) -> "0140168-2"    untouched by luck (already 9 chars)
 *   420621088    (FR) -> "420621088"    untouched by luck (already 9 chars)
 *
 * Two of those four survive only because they happen to be long enough. That is
 * not a design, it is a coincidence, and it breaks the moment a shorter foreign
 * identifier arrives.
 *
 * MIRRORS `opendata/src/lib/national-id.ts`. The two repos ship separately and
 * share no package, so this is a deliberate second copy of one rule: pad ONLY
 * the legacy 8-digit IČO registers. It is kept tiny and stated as an allow-list
 * precisely because it cannot be held in sync by a test — a deny-list would
 * silently swallow each new market as it is added.
 */

/** Registers whose national id IS the legacy 8-digit IČO, zero-padded. */
const ZERO_PADDED_TO_8 = new Set(["SK", "CZ", "EE"]);

/**
 * Normalise a registry identifier for a request.
 *
 * With no country the caller is on the legacy path and gets the historical
 * padding, so nothing that worked yesterday changes. With a country, padding
 * applies only where it is correct.
 */
export function normalizeRegistryId(ico: string, country?: string): string {
  const raw = ico.trim().replace(/\s/g, "");
  if (!country) return raw.padStart(8, "0");
  return ZERO_PADDED_TO_8.has(country.toUpperCase()) ? raw.padStart(8, "0") : raw;
}

/** `{ country: "FR" }` when supplied, so it can be spread into a query object. */
export function countryQuery(country?: string): Record<string, string> {
  return country ? { country: country.toUpperCase() } : {};
}
