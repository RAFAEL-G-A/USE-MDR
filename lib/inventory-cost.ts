export function weightedAverageCost(currentStock: number, currentAverageCost: number, incomingQuantity: number, incomingUnitCost: number) {
  if (!Number.isInteger(currentStock) || currentStock < 0) throw new Error("Estoque atual inválido.");
  if (!Number.isFinite(currentAverageCost) || currentAverageCost < 0) throw new Error("Custo médio atual inválido.");
  if (!Number.isInteger(incomingQuantity) || incomingQuantity <= 0) throw new Error("Quantidade de entrada inválida.");
  if (!Number.isFinite(incomingUnitCost) || incomingUnitCost < 0) throw new Error("Custo da entrada inválido.");
  return Math.round((((currentStock * currentAverageCost) + (incomingQuantity * incomingUnitCost)) / (currentStock + incomingQuantity)) * 100) / 100;
}
