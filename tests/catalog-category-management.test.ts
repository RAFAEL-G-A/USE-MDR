import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { catalogTaxonomy } from "../lib/catalog-taxonomy.ts";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("a estrutura dinâmica preserva leitura pública e restringe escrita", () => {
  const migration = source("../supabase/migrations/20260821153000_catalog_categories.sql");
  assert.match(migration, /create table if not exists public\.catalog_categories/i);
  assert.match(migration, /create table if not exists public\.catalog_subcategories/i);
  assert.match(migration, /references public\.catalog_categories\(category_key\) on delete restrict/i);
  assert.match(migration, /alter table public\.catalog_categories enable row level security/i);
  assert.match(migration, /grant select .* to anon, authenticated/i);
  assert.match(migration, /revoke insert, update, delete .* from anon, authenticated/i);
  assert.match(migration, /catalog_subcategories_category_key_idx/i);
});

test("a migration inclui todas as categorias atuais sem alterar produtos", () => {
  const migration = source("../supabase/migrations/20260821153000_catalog_categories.sql");
  for (const [category, subcategories] of Object.entries(catalogTaxonomy)) {
    assert.ok(migration.includes(category), `${category} deve ser preservada`);
    for (const subcategory of subcategories) {
      assert.ok(migration.includes(subcategory), `${subcategory} deve ser preservada`);
    }
  }
  const installationStatements = migration.split("create or replace function public.rename_catalog_category")[0];
  assert.doesNotMatch(installationStatements, /update\s+public\.products/i);
  assert.doesNotMatch(installationStatements, /delete\s+from\s+public\.products/i);
});

test("a API bloqueia remoção de subcategoria que possui produtos", () => {
  const api = source("../supabase/functions/manage-catalog-categories/index.ts");
  assert.match(api, /await authenticateAdmin\(request\)/);
  assert.match(api, /await assertInventoryAccess\(context\)/);
  assert.match(api, /\.from\("products"\)/);
  assert.match(api, /Não é possível remover: existem/);
  assert.match(api, /storage\.from\("products"\)\.remove/);
});

test("cadastro fica antes da edição na tela de estoque", () => {
  const inventory = source("../components/admin-inventory-manager.tsx");
  const createPosition = inventory.indexOf("<AdminProductForm onCreated={refresh} />");
  const editPosition = inventory.indexOf("INVENTÁRIO ATUAL");
  assert.ok(createPosition > 0);
  assert.ok(editPosition > createPosition);
});

test("cadastro e edição de produtos usam a taxonomia dinâmica", () => {
  const createForm = source("../components/admin-product-form.tsx");
  const inventory = source("../components/admin-inventory-manager.tsx");
  const createApi = source("../supabase/functions/create-product/index.ts");
  const manageApi = source("../supabase/functions/manage-product/index.ts");
  assert.match(createForm, /useCatalogTaxonomy/);
  assert.match(inventory, /useCatalogTaxonomy/);
  assert.match(createApi, /await isValidCatalogSelection/);
  assert.match(manageApi, /await isValidCatalogSelection/);
});

test("renomeações atualizam classificação e configuração na mesma transação", () => {
  const migration = source("../supabase/migrations/20260821153000_catalog_categories.sql");
  assert.match(migration, /function public\.rename_catalog_category/);
  assert.match(migration, /update public\.products[\s\S]*set category = p_new_name[\s\S]*update public\.catalog_categories/);
  assert.match(migration, /function public\.rename_catalog_subcategory/);
  assert.match(migration, /set subcategory = p_new_name[\s\S]*update public\.catalog_subcategories/);
  assert.match(migration, /grant execute on function public\.rename_catalog_category[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.rename_catalog_category[\s\S]*to anon/);
});

test("reordenação é validada e aplicada por funções transacionais", () => {
  const migration = source("../supabase/migrations/20260821153000_catalog_categories.sql");
  const api = source("../supabase/functions/manage-catalog-categories/index.ts");
  assert.match(migration, /function public\.reorder_catalog_categories/);
  assert.match(migration, /cardinality\(p_category_keys\)/);
  assert.match(migration, /unnest\(p_category_keys\) with ordinality/);
  assert.match(migration, /function public\.reorder_catalog_subcategories/);
  assert.match(api, /rpc\("reorder_catalog_categories"/);
  assert.match(api, /rpc\("reorder_catalog_subcategories"/);
});

test("painel oferece busca, contadores, prévia, visibilidade, ordem e histórico", () => {
  const component = source("../components/admin-categories-manager.tsx");
  for (const feature of [
    "Pesquisar categoria ou subcategoria",
    "VER NO CATÁLOGO",
    "OCULTAR DA VITRINE",
    "moveCategory",
    "moveSubcategory",
    "subcategoryCounts",
    "Alterações recentes",
  ]) assert.ok(component.includes(feature), `${feature} deve estar disponível`);
});
