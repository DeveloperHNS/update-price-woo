/**
 * Format a raw price string into Indonesian Rupiah format.
 * e.g., "6125000" → "Rp 6.125.000"
 */
export function formatRp(raw: string | null | undefined): string {
  if (!raw) return "—";
  const cleaned = raw.replace(/[Rp\s.]/gi, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw;
  return "Rp " + num.toLocaleString("id-ID");
}

/**
 * Format a numeric string with Indonesian thousand separators (dots).
 * e.g., "6125000" → "6.125.000"
 * Used for input fields where we want visual formatting without "Rp" prefix.
 */
export function formatNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

/**
 * Parse a formatted Rupiah string back to plain digits.
 * e.g., "6.125.000" → "6125000"
 */
export function parseFormattedNumber(value: string): string {
  return value.replace(/\D/g, "");
}
