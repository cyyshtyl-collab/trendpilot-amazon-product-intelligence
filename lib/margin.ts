export type MarginCostInput = {
  sellingPrice: number;
  productCost: number;
  inboundFreight: number;
  platformFees: number;
  otherCosts: number;
};

export type MarginResult = {
  grossProfit: number;
  marginPercent: number;
  totalCost: number;
};

/** Calculates gross profit and margin from non-negative unit costs. */
export function calculateGrossMargin(
  input: MarginCostInput,
): MarginResult | null {
  const values = Object.values(input);
  if (
    !values.every(Number.isFinite) ||
    input.sellingPrice <= 0 ||
    values.slice(1).some((value) => value < 0)
  ) {
    return null;
  }
  const totalCost =
    input.productCost +
    input.inboundFreight +
    input.platformFees +
    input.otherCosts;
  const grossProfit = input.sellingPrice - totalCost;
  return {
    grossProfit,
    marginPercent: (grossProfit / input.sellingPrice) * 100,
    totalCost,
  };
}

/** Parses a currency-like display value into a usable positive amount. */
export function parseMoney(value: string | number | undefined): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
