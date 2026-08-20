import assert from "node:assert/strict";
import test from "node:test";
import { filterProductsByName, groupSaleRows, saleCartTotal, upsertSaleCartItem, validateDiscountedTotal, type SaleRow } from "../lib/admin-sales.ts";
import { applyFinalSaleTotal } from "../supabase/functions/_shared/sale-discount.ts";

test("soma e agrupa produtos repetidos no carrinho", () => {
  const first = { product_id: "p1", product_name: "Gloss", quantity: 1, unit_price: 20, stock: 5 };
  const items = upsertSaleCartItem(upsertSaleCartItem([], first), { ...first, quantity: 2 });
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 3);
  assert.equal(saleCartTotal(items), 60);
});

test("impede quantidade maior que o estoque", () => {
  const item = { product_id: "p1", product_name: "Gloss", quantity: 3, unit_price: 20, stock: 4 };
  assert.throws(() => upsertSaleCartItem([item], { ...item, quantity: 2 }), /Estoque insuficiente/);
});

test("várias linhas com o mesmo order_id formam um pedido", () => {
  const base: SaleRow = {
    id: "s1", order_id: "o1", product_id: "p1", product_name: "Gloss", quantity: 1,
    unit_price: 20, total_amount: 20, customer_name: null, payment_method: "pix",
    payment_status: "paid", sold_at: "2026-08-18T12:00:00Z", notes: null, voided_at: null,
  };
  const orders = groupSaleRows([base, { ...base, id: "s2", product_id: "p2", product_name: "Batom", quantity: 2, total_amount: 30 }]);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].units, 3);
  assert.equal(orders[0].total, 50);
});

test("aceita valor com desconto e rejeita valor acima do original", () => {
  assert.deepEqual(validateDiscountedTotal(100, "89,90"), { value: 89.9, error: null });
  assert.match(validateDiscountedTotal(100, "101,00").error ?? "", /não pode ser maior/);
});

test("distribui o desconto em venda agrupada sem perder centavos", () => {
  const result = applyFinalSaleTotal([
    { product_id: "p1", quantity: 3, unit_price: 19.9 },
    { product_id: "p2", quantity: 2, unit_price: 12.5 },
  ], 72.37);
  const registeredTotal = result.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price * 100) / 100, 0);
  assert.equal(Math.round(registeredTotal * 100), 7237);
  assert.equal(result.originalTotal, 84.7);
  assert.equal(result.finalTotal, 72.37);
});

test("pesquisa produtos por nome sem diferenciar acentos ou maiúsculas", () => {
  const products = [
    { id: "p1", name: "Cola de Cílios" },
    { id: "p2", name: "Máscara Ruby" },
    { id: "p3", name: "Gloss Crystal" },
  ];
  assert.deepEqual(filterProductsByName(products, "cilios cola").map((item) => item.id), ["p1"]);
  assert.deepEqual(filterProductsByName(products, "MASCARA").map((item) => item.id), ["p2"]);
  assert.equal(filterProductsByName(products, "produto inexistente").length, 0);
});
