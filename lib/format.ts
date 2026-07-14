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

/**
 * Smart Name Formatter: Extracts specs from a raw product name and returns
 * the cleaned main name and the joined specs string.
 */
export function parseProductName(rawName: string): { name: string, specs: string } {
  if (!rawName) return { name: "", specs: "" };
  
  let name = rawName;
  const specs: string[] = [];

  // CPU (e.g. i7, i5-12500H, Ryzen 5, Ryzen 7 5800H)
  const cpuPattern = /\b(i3|i5|i7|i9|Ryzen\s?\d|Celeron|Pentium|Athlon)\b(?:-[A-Za-z0-9]+|\s[A-Za-z0-9]{4,5}[A-Za-z]{1,2})?/ig;
  const cpuMatch = name.match(cpuPattern);
  if (cpuMatch) {
    specs.push(...cpuMatch);
    name = name.replace(cpuPattern, '');
  }

  // GPU (e.g. RTX3050, RTX 4060, GTX 1650, Radeon)
  const gpuPattern = /\b(RTX\s?\d{3,4}|GTX\s?\d{3,4}|Radeon(?:\sGraphics)?|Intel\sUHD(?:\sGraphics)?|Iris\sXe|RX\s?\d{3,4})\b(?:\s?Ti|\s?Super)?/ig;
  const gpuMatch = name.match(gpuPattern);
  if (gpuMatch) {
    specs.push(...gpuMatch);
    name = name.replace(gpuPattern, '');
  }

  // RAM & Storage (e.g. 8GB, 16 GB, 512GB, 1TB)
  const capPattern = /\b\d+\s?(GB|TB)\b/ig;
  const capMatch = name.match(capPattern);
  if (capMatch) {
    specs.push(...capMatch);
    name = name.replace(capPattern, '');
  }

  // Storage Type
  const storageTypePattern = /\b(SSD|NVME|HDD)\b/ig;
  const storageTypeMatch = name.match(storageTypePattern);
  if (storageTypeMatch) {
    specs.push(...storageTypeMatch);
    name = name.replace(storageTypePattern, '');
  }

  // Display (e.g. 15.6, 14", FHD, IPS, 144Hz)
  const displayPattern = /\b(\d{2}(\.\d)?\s?(inch|"|'')|FHD|IPS|OLED|WUXGA|144Hz|165Hz)\b/ig;
  const displayMatch = name.match(displayPattern);
  if (displayMatch) {
    specs.push(...displayMatch);
    name = name.replace(displayPattern, '');
  }

  // Software / OS
  const softPattern = /\b(Win\s?10|Win\s?11|DOS|OHS)\b/ig;
  const softMatch = name.match(softPattern);
  if (softMatch) {
    specs.push(...softMatch);
    name = name.replace(softPattern, '');
  }

  // Clean up remaining spaces, dashes, dots
  name = name.replace(/\s+/g, ' ').trim();
  name = name.replace(/^[-/.]+|[-/.]+$/g, '').trim();

  // Deduplicate and format specs nicely
  const uniqueSpecs = Array.from(new Set(specs.map(s => s.trim().toUpperCase())));

  return {
    name: name,
    specs: uniqueSpecs.join(' · ')
  };
}
