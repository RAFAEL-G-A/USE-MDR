export type DiscountableSaleItem = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function applyFinalSaleTotal<T extends DiscountableSaleItem>(items: T[], rawFinalTotal: unknown) {
  const originalLineCents = items.map((item) => cents(item.quantity * item.unit_price));
  const originalTotalCents = originalLineCents.reduce((sum, value) => sum + value, 0);

  if (rawFinalTotal === undefined || rawFinalTotal === null || rawFinalTotal === "") {
    return { items, originalTotal: originalTotalCents / 100, finalTotal: originalTotalCents / 100 };
  }

  const requestedTotal = Number(rawFinalTotal);
  const finalTotalCents = cents(requestedTotal);
  if (!Number.isFinite(requestedTotal) || finalTotalCents <= 0) {
    throw new Error("O valor com desconto deve ser maior que zero.");
  }
  if (finalTotalCents > originalTotalCents) {
    throw new Error("O valor com desconto não pode ser maior que o total original.");
  }

  const shares = originalLineCents.map((lineCents, index) => {
    const exact = finalTotalCents * lineCents / originalTotalCents;
    const allocated = Math.floor(exact);
    return { index, allocated, remainder: exact - allocated };
  });
  let remaining = finalTotalCents - shares.reduce((sum, share) => sum + share.allocated, 0);
  [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index).forEach((share) => {
    if (remaining > 0) {
      shares[share.index].allocated += 1;
      remaining -= 1;
    }
  });

  const adjustedItems = items.map((item, index) => ({
    ...item,
    unit_price: Number((shares[index].allocated / (100 * item.quantity)).toFixed(8)),
  }));
  return { items: adjustedItems, originalTotal: originalTotalCents / 100, finalTotal: finalTotalCents / 100 };
}
