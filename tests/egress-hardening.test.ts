import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("restringe a otimização ao bucket público deste projeto Supabase", () => {
  const config = source("next.config.ts");
  assert.match(config, /hostname:\s*"tsrsncnraamnhcfyyxlg\.supabase\.co"/);
  assert.match(config, /pathname:\s*"\/storage\/v1\/object\/public\/products\/\*\*"/);
  assert.doesNotMatch(config, /hostname:\s*"\*\*\.supabase\.co"/);
});

test("normaliza a chave do cache e rejeita parâmetros extras de imagem", () => {
  const worker = source("custom-worker.ts");
  assert.match(worker, /OPTIMIZED_IMAGE_QUERY_PARAMETERS = \["url", "w", "q"\]/);
  assert.match(worker, /url\.searchParams\.getAll\(parameter\)\.length === 1/);
  assert.match(worker, /new URL\(OPTIMIZED_IMAGE_PATH, requestUrl\.origin\)/);
  assert.match(worker, /new Response\("Invalid image request\.", \{ status: 400 \}\)/);
  assert.match(worker, /X-UseMdr-Image-Cache", "HIT"/);
  assert.match(worker, /X-UseMdr-Image-Cache", "MISS"/);
});

test("não transfere campos pesados nas listagens da vitrine", () => {
  const products = source("lib/products.ts");
  const listSelect = /\.select\("id, name, price, promotional_price, show_in_promotions, category, subcategory, image_url, stock"\)/g;
  assert.equal(products.match(listSelect)?.length, 2);
  assert.match(products, /\.select\("id, name, price, promotional_price, show_in_promotions, category, subcategory, image_url, description, stock"\)/);
});
