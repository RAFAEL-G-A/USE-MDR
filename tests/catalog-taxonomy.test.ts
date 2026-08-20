import assert from "node:assert/strict";
import test from "node:test";
import { catalogTaxonomy as webTaxonomy } from "../lib/catalog-taxonomy.ts";
import { catalogTaxonomy as apiTaxonomy } from "../supabase/functions/_shared/catalog-taxonomy.ts";

test("oferece Brumas como subcategoria de Pele", () => {
  assert.ok(webTaxonomy.Pele.includes("Brumas"));
});

test("mantém em Pele somente as subcategorias solicitadas", () => {
  assert.deepEqual(webTaxonomy.Pele, ["Bases", "Corretivos", "Pós", "Primers", "Brumas"]);
});

test("move maquiagem de rosto e sombras para Paletas", () => {
  assert.deepEqual(webTaxonomy.Paletas, ["Blush", "Iluminador", "Contorno", "Sombra", "Multifuncionais"]);
});

test("oferece Cílios e Cola de Cílios em Olhos", () => {
  assert.ok(webTaxonomy.Olhos.includes("Cílios"));
  assert.ok(webTaxonomy.Olhos.includes("Cola de Cílios"));
  assert.ok(!(webTaxonomy.Olhos as readonly string[]).includes("Sombras"));
  assert.ok(!(webTaxonomy.Olhos as readonly string[]).includes("Cola"));
});

test("mantém as categorias do site e da API sincronizadas", () => {
  assert.deepEqual(apiTaxonomy, webTaxonomy);
});
