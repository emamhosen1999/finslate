/**
 * Format a number as BDT using the South Asian (lakhs / crores) grouping.
 * e.g. 100000 -> "৳1,00,000".
 */
export const formatBDT = (amount, { withSymbol = true, withSign = false } = {}) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return withSymbol ? '৳0' : '0';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const sign = num < 0 ? '-' : withSign ? '+' : '';
  return `${sign}${withSymbol ? '৳' : ''}${formatted}`;
};

export const formatBDTCompact = (amount) => {
  const num = Number(amount) || 0;
  const abs = Math.abs(num);
  if (abs >= 10000000) return `৳${(num / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `৳${(num / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `৳${(num / 1000).toFixed(1)}K`;
  return formatBDT(num);
};
