import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { effectiveProductPrice, productDiscountPercentage, validPromotionalPrice } from "../lib/product-promotion.ts";

const migration = readFileSync("supabase/migrations/20260909194816_add_product_promotions.sql", "utf8");
const catalog = readFileSync("app/catalogo/page.tsx", "utf8");
const card = readFileSync("components/product-card.tsx", "utf8");
const manager = readFileSync("components/admin-inventory-manager.tsx", "utf8");

test("calcula percentual e preço efetivo sem arredondar o valor cobrado", () => {
  assert.equal(productDiscountPercentage(10, 8), 20);
  assert.equal(productDiscountPercentage(14, 12.5), 11);
  assert.equal(effectiveProductPrice(10, 8), 8);
  assert.equal(effectiveProductPrice(10, null), 10);
});

test("ignora descontos inválidos", () => {
  assert.equal(validPromotionalPrice(10, 10), false);
  assert.equal(validPromotionalPrice(10, 12), false);
  assert.equal(validPromotionalPrice(10, 0), false);
  assert.equal(productDiscountPercentage(10, null), null);
});

test("banco protege preço promocional e seleção da vitrine", () => {
  assert.match(migration, /promotional_price > 0 and promotional_price < price/i);
  assert.match(migration, /show_in_promotions = false or promotional_price is not null/i);
  assert.match(migration, /where show_in_promotions = true and promotional_price is not null and stock > 0/i);
});

test("vitrine de descontos é adicional e aparece primeiro", () => {
  assert.match(catalog, /selectedCategory === "Produtos com desconto" \? product\.showInPromotions/);
  assert.match(catalog, /Produtos com desconto[\s\S]*categories\.map/);
  assert.match(manager, /O produto continua na categoria e subcategoria atuais/);
});

test("card usa o preço promocional no carrinho e reserva altura para preços", () => {
  assert.match(card, /price: salePrice/);
  assert.match(card, /min-h-12 sm:min-h-14/);
  assert.match(card, /line-through/);
  assert.match(card, /-\{discountPercentage\}%/);
});
