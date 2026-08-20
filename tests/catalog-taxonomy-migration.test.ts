import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260819084500_reorganize_catalog_taxonomy.sql",
  "utf8",
);

test("reclassifica os produtos sem apagar ou recriar registros", () => {
  assert.match(migration, /update public\.products/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.doesNotMatch(migration, /\binsert\s+into\b/i);
});

test("altera somente categoria e subcategoria", () => {
  assert.match(migration, /set category = 'Paletas'/i);
  assert.match(migration, /set subcategory = 'Primers'/i);
  assert.match(migration, /set subcategory = 'Cola de Cílios'/i);
  assert.doesNotMatch(migration, /\b(name|price|image_url|description|stock|id)\s*=/i);
});
