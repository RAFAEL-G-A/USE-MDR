export type SaleCartItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  stock: number;
};

export type SaleRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer_name: string | null;
  payment_method: "credit_card" | "debit_card" | "pix" | "cash";
  payment_status: "paid" | "pending";
  sold_at: string;
  notes: string | null;
  voided_at: string | null;
};

export type SaleOrder = {
  order_id: string;
  rows: SaleRow[];
  total: number;
  units: number;
  sold_at: string;
  customer_name: string | null;
  payment_method: SaleRow["payment_method"];
  payment_status: SaleRow["payment_status"];
  voided: boolean;
};

export type SaleCorrection = {
  id: string;
  order_id: string;
  previous_total: number;
  corrected_total: number;
  reason: string;
  corrected_at: string;
};

export function upsertSaleCartItem(items: SaleCartItem[], next: SaleCartItem) {
  const current = items.find((item) => item.product_id === next.product_id);
  if (!current) return [...items, next];
  const quantity = current.quantity + next.quantity;
  if (quantity > next.stock) throw new Error(`Estoque insuficiente. Disponível: ${next.stock}.`);
  return items.map((item) => item.product_id === next.product_id ? { ...next, quantity } : item);
}

export function saleCartTotal(items: SaleCartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}

export function parseBrazilianCurrency(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

export function validateDiscountedTotal(baseTotal: number, value: string) {
  if (!value.trim()) return { value: null, error: null };
  const discountedTotal = parseBrazilianCurrency(value);
  if (!Number.isFinite(discountedTotal) || discountedTotal <= 0) {
    return { value: null, error: "O valor com desconto deve ser maior que zero." };
  }
  if (Math.round(discountedTotal * 100) > Math.round(baseTotal * 100)) {
    return { value: null, error: "O valor com desconto não pode ser maior que o total original." };
  }
  return { value: Math.round(discountedTotal * 100) / 100, error: null };
}

export function groupSaleRows(rows: SaleRow[]): SaleOrder[] {
  const groups = new Map<string, SaleRow[]>();
  for (const row of rows) {
    const group = groups.get(row.order_id) ?? [];
    group.push(row);
    groups.set(row.order_id, group);
  }
  return [...groups.entries()].map(([orderId, orderRows]) => {
    const first = orderRows[0];
    return {
      order_id: orderId,
      rows: orderRows,
      total: orderRows.reduce((sum, row) => sum + row.total_amount, 0),
      units: orderRows.reduce((sum, row) => sum + row.quantity, 0),
      sold_at: first.sold_at,
      customer_name: first.customer_name,
      payment_method: first.payment_method,
      payment_status: (orderRows.every((row) => row.payment_status === "paid") ? "paid" : "pending") as SaleRow["payment_status"],
      voided: orderRows.every((row) => Boolean(row.voided_at)),
    };
  }).sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime());
}
