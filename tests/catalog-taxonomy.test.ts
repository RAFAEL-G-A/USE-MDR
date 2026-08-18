import assert from "node:assert/strict";
import test from "node:test";
import { catalogTaxonomy as webTaxonomy } from "../lib/catalog-taxonomy.ts";
import { catalogTaxonomy as apiTaxonomy } from "../supabase/functions/_shared/catalog-taxonomy.ts";

test("oferece Brumas como subcategoria de Pele", () => {
  assert.ok(webTaxonomy.Pele.includes("Brumas"));
});

test("mantém as categorias do site e da API sincronizadas", () => {
  assert.deepEqual(apiTaxonomy, webTaxonomy);
});
