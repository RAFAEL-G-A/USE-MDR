import assert from "node:assert/strict";
import test from "node:test";
import { catalogPageCount, PRODUCTS_PER_PAGE, validCatalogPage, visibleCatalogPages } from "../lib/catalog-pagination.ts";

test("divide 200 produtos em 14 páginas de até 15 itens", () => {
  assert.equal(PRODUCTS_PER_PAGE, 15);
  assert.equal(catalogPageCount(200), 14);
  assert.equal(200 - (14 - 1) * PRODUCTS_PER_PAGE, 5);
});

test("mantém números de página inválidos dentro dos limites", () => {
  assert.equal(validCatalogPage(null, 14), 1);
  assert.equal(validCatalogPage("0", 14), 1);
  assert.equal(validCatalogPage("8", 14), 8);
  assert.equal(validCatalogPage("99", 14), 14);
});

test("resume a paginação longa preservando início, vizinhas e fim", () => {
  assert.deepEqual(visibleCatalogPages(8, 14), [1, "ellipsis", 7, 8, 9, "ellipsis", 14]);
});
