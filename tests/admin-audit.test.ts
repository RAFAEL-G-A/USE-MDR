import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260907204833_add_admin_audit_logs.sql", "utf8");
const helper = readFileSync("supabase/functions/_shared/admin-audit.ts", "utf8");
const auditedFunctions = [
  "create-product",
  "manage-product",
  "manage-sales",
  "manage-finances",
  "manage-hero-slide",
  "manage-catalog-categories",
  "manage-category-image",
  "verify-admin-code",
  "authorize-admin-session",
  "manage-admin-users",
  "manage-inventory-acquisitions",
].map((name) => readFileSync(`supabase/functions/${name}/index.ts`, "utf8")).join("\n");

test("auditoria administrativa fica fechada para clientes e disponível ao service role", () => {
  assert.match(migration, /alter table public\.admin_audit_logs enable row level security/i);
  assert.match(migration, /revoke all on table public\.admin_audit_logs from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert on table public\.admin_audit_logs to service_role/i);
});

test("schema de auditoria limita resultado e tamanho de metadata", () => {
  assert.match(migration, /result in \('success', 'failure'\)/i);
  assert.match(migration, /jsonb_typeof\(metadata\) = 'object'/i);
  assert.match(migration, /octet_length\(metadata::text\) <= 8192/i);
});

test("helper de auditoria não propaga falhas nem registra secrets ou payloads", () => {
  assert.match(helper, /catch \{/);
  assert.match(helper, /return false/);
  assert.match(helper, /error: "audit_insert_failed"/);
  assert.match(helper, /SENSITIVE_METADATA_KEY/);
  assert.match(helper, /filter\(\(\[key\]\) => !SENSITIVE_METADATA_KEY\.test\(key\)\)/);
  assert.doesNotMatch(helper, /rawBody|request\.text\(|request\.json\(/i);
});

test("ações críticas usam o helper compartilhado de auditoria", () => {
  for (const action of [
    "create_product",
    "update_product",
    "delete_product",
    "stock_change",
    "create_sale",
    "update_sale",
    "delete_sale",
    "financial_change",
    "hero_change",
    "category_change",
    "admin_verification_success",
    "admin_verification_failure",
    "admin_user_change",
    "inventory_acquisition",
  ]) {
    assert.match(auditedFunctions, new RegExp(`action: "${action}"`));
  }
});
