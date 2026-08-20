import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260819133000_store_analytics.sql", "utf8");
const tracker = readFileSync("components/store-analytics-tracker.tsx", "utf8");
const cart = readFileSync("components/cart-page-client.tsx", "utf8");
const publicFunction = readFileSync("supabase/functions/track-store-event/index.ts", "utf8");
const adminFunction = readFileSync("supabase/functions/manage-analytics/index.ts", "utf8");
const emailFunction = readFileSync("supabase/functions/run-financial-reports/index.ts", "utf8");

test("limita cada sessão a uma visita e uma ida ao WhatsApp", () => {
  assert.match(migration, /unique \(session_id, event_type\)/i);
  assert.match(publicFunction, /error\.code !== "23505"/);
  assert.match(tracker, /SESSION_DURATION_MS = 30 \* 60 \* 1000/);
});

test("não coleta dados pessoais nem o conteúdo do pedido", () => {
  const storageColumns = migration.match(/create table[\s\S]*?\n\);/i)?.[0] ?? "";
  assert.doesNotMatch(storageColumns, /\b(email|phone|ip_address|user_agent|customer_name|product_name|message)\b/i);
  assert.match(cart, /cartItemCount: totalQuantity, cartTotal: total/);
  assert.doesNotMatch(cart, /trackStoreEvent\([^)]*(items|whatsappUrl)/);
});

test("mantém a leitura das métricas restrita ao administrador verificado", () => {
  assert.match(adminFunction, /await authenticateAdmin\(request\)/);
  assert.match(adminFunction, /await assertInventoryAccess\(context\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.store_analytics_events from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.get_store_analytics\(date, date\) from public, anon, authenticated/i);
});

test("não contabiliza o painel administrativo nem gera métricas na prévia local", () => {
  assert.match(tracker, /pathname\.startsWith\("\/admin"\)/);
  assert.match(tracker, /process\.env\.NODE_ENV !== "production"/);
  assert.match(publicFunction, /BOT_PATTERN\.test/);
});

test("o clique no WhatsApp não espera a métrica para abrir", () => {
  assert.match(cart, /onClick=\{\(\) => void trackStoreEvent\("whatsapp_checkout"/);
  assert.match(cart, /target="_blank"/);
});

test("inclui as métricas agregadas nos relatórios enviados por e-mail", () => {
  assert.match(emailFunction, /client\.rpc\("get_store_analytics"/);
  assert.match(emailFunction, /JORNADA DO SITE ATÉ O WHATSAPP/);
  assert.match(emailFunction, /Valor potencial dos carrinhos/);
  assert.match(emailFunction, /store_analytics: analyticsPayload\.summary/);
});
