import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { applyFinalSaleTotal } from "../supabase/functions/_shared/sale-discount.ts";

const correctionMigration = readFileSync(new URL("../supabase/migrations/20260818194500_sale_corrections.sql", import.meta.url), "utf8");
const salesFunction = readFileSync(new URL("../supabase/functions/manage-sales/index.ts", import.meta.url), "utf8");

function registeredCents(items: Array<{ quantity: number; unit_price: number }>) {
  return items.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price * 100), 0);
}

test("mantém exatamente cada centavo em milhares de totais com desconto", () => {
  const items = [
    { product_id: "p1", quantity: 3, unit_price: 19.9 },
    { product_id: "p2", quantity: 2, unit_price: 12.5 },
  ];
  const originalCents = registeredCents(items);
  for (let requestedCents = 1; requestedCents <= originalCents; requestedCents += 1) {
    const adjusted = applyFinalSaleTotal(items, requestedCents / 100);
    assert.equal(registeredCents(adjusted.items), requestedCents);
  }
});

test("suporta venda com o limite de 50 produtos", () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    product_id: `p${index + 1}`,
    quantity: index % 4 + 1,
    unit_price: 5.75 + index,
  }));
  const adjusted = applyFinalSaleTotal(items, 999.99);
  assert.equal(adjusted.items.length, 50);
  assert.equal(registeredCents(adjusted.items), 99_999);
});

test("não altera os itens quando o desconto fica vazio", () => {
  const items = [{ product_id: "p1", quantity: 2, unit_price: 10 }];
  const adjusted = applyFinalSaleTotal(items, null);
  assert.equal(adjusted.items, items);
  assert.equal(adjusted.finalTotal, 20);
});

test("rejeita desconto zero, inválido ou acima do total", () => {
  const items = [{ product_id: "p1", quantity: 1, unit_price: 10 }];
  assert.throws(() => applyFinalSaleTotal(items, 0), /maior que zero/);
  assert.throws(() => applyFinalSaleTotal(items, "valor inválido"), /maior que zero/);
  assert.throws(() => applyFinalSaleTotal(items, 10.01), /não pode ser maior/);
});

test("correção bloqueia linhas da venda e dos produtos antes de atualizar", () => {
  assert.match(correctionMigration, /where order_id = p_order_id and voided_at is null[\s\S]*for update;/i);
  assert.match(correctionMigration, /from public\.products product[\s\S]*order by product\.id[\s\S]*for update;/i);
});

test("correção do pedido só modifica o estoque no cadastro público do produto", () => {
  const productUpdates = [...correctionMigration.matchAll(/update public\.products[\s\S]*?;/gi)].map((match) => match[0]);
  assert.equal(productUpdates.length, 2);
  for (const statement of productUpdates) {
    assert.match(statement, /set stock = stock [+-]/i);
    assert.doesNotMatch(statement, /\b(name|price|category|subcategory|image_url|description|is_launch)\s*=/i);
  }
});

test("histórico de correções não fica acessível ao catálogo público", () => {
  assert.match(correctionMigration, /alter table public\.sale_order_revisions enable row level security;/i);
  assert.match(correctionMigration, /revoke all on table public\.sale_order_revisions from public, anon, authenticated;/i);
  assert.match(correctionMigration, /revoke all on function public\.update_sale_order[\s\S]*from public, anon, authenticated;/i);
  assert.match(correctionMigration, /grant execute on function public\.update_sale_order[\s\S]*to service_role;/i);
});

test("edição usa uma única função transacional e exige autenticação administrativa", () => {
  assert.match(salesFunction, /await authenticateAdmin\(request\)/);
  assert.match(salesFunction, /await assertInventoryAccess\(context\)/);
  const updateSection = salesFunction.slice(salesFunction.indexOf('if (action === "update_order")'), salesFunction.indexOf('if (action === "settle")'));
  assert.match(updateSection, /\.rpc\("update_sale_order"/);
  assert.doesNotMatch(updateSection, /\.from\("products"\)\.(update|insert|delete)/);
});

test("fechamento inclui correções como auditoria sem somá-las novamente à receita", () => {
  const closureSection = correctionMigration.slice(correctionMigration.indexOf("create or replace function public.create_financial_closure"));
  assert.match(closureSection, /'sale_corrections', public\.get_sale_corrections/);
  assert.doesNotMatch(closureSection, /gross_revenue[^;]*difference/i);
  assert.doesNotMatch(closureSection, /sum\([^)]*corrected_total/i);
});

test("cada migração possui uma versão exclusiva", () => {
  const files = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((file) => file.endsWith(".sql"));
  const versions = files.map((file) => file.split("_")[0]);
  assert.equal(new Set(versions).size, versions.length);
  assert.ok(files.includes("20260818172632_admin_multi_device_sessions.sql"));
});
