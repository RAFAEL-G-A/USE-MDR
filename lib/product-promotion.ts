export function validPromotionalPrice(regularPrice: number, promotionalPrice?: number | null) {
  return Number.isFinite(regularPrice)
    && regularPrice > 0
    && typeof promotionalPrice === "number"
    && Number.isFinite(promotionalPrice)
    && promotionalPrice > 0
    && promotionalPrice < regularPrice;
}

export function effectiveProductPrice(regularPrice: number, promotionalPrice?: number | null) {
  return validPromotionalPrice(regularPrice, promotionalPrice) ? promotionalPrice as number : regularPrice;
}

export function productDiscountPercentage(regularPrice: number, promotionalPrice?: number | null) {
  if (!validPromotionalPrice(regularPrice, promotionalPrice)) return null;
  return Math.round((1 - (promotionalPrice as number) / regularPrice) * 100);
}
