import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { weightedAverageCost } from "../lib/inventory-cost.ts";

const migration = readFileSync("supabase/migrations/20260909144734_add_inventory_acquisitions_and_admin_staff.sql", "utf8");
const productForm = readFileSync("components/admin-product-form.tsx", "utf8");
const productManager = readFileSync("supabase/functions/manage-product/index.ts", "utf8");

test("calcula o custo médio ponderado do saldo restante com a nova entrada", () => {
  assert.equal(weightedAverageCost(4, 30, 10, 40), 37.14);
  assert.equal(weightedAverageCost(0, 0, 10, 40), 40);
});

test("rejeita valores de entrada que corromperiam o estoque", () => {
  assert.throws(() => weightedAverageCost(4, 30, 0, 40));
  assert.throws(() => weightedAverageCost(4, 30, 10, -1));
});

test("aquisição atualiza estoque, custo e preço opcionalmente em uma transação", () => {
  assert.match(migration, /for update/i);
  assert.match(migration, /v_new_average := round/i);
  assert.match(migration, /coalesce\(p_sale_price, v_product\.price\)/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /revoke all on function public\.register_inventory_acquisition/i);
  assert.match(migration, /grant execute on function public\.register_inventory_acquisition/i);
});

test("produto nasce sem estoque e edição comum não altera custo ou quantidade", () => {
  assert.doesNotMatch(productForm, /name="cost_price"/);
  assert.doesNotMatch(productForm, /name="stock"/);
  assert.doesNotMatch(productManager, /\.update\(\{ name, price, category, subcategory,[^}]*\bstock\b/);
  assert.doesNotMatch(productManager, /\.from\("product_costs"\)[\s\S]*?\.upsert/);
});
