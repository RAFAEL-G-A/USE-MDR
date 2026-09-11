import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260910165701_update_weekday_closing_to_18h.sql", import.meta.url),
  "utf8",
);
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const finances = readFileSync(new URL("../components/admin-finances.tsx", import.meta.url), "utf8");

test("fecha a data comercial às 18h de segunda a sexta e mantém sábado às 13h", () => {
  assert.match(migration, /v_iso_day between 1 and 5 and v_time >= time '18:00'/);
  assert.match(migration, /v_iso_day = 6 and v_time >= time '13:00'/);
  assert.doesNotMatch(migration, /v_time >= time '17:00'/);
});

test("agenda o fechamento de dias úteis para 18h em Pernambuco", () => {
  assert.match(wrangler, /"5 21 \* \* 1-5"/);
  assert.match(wrangler, /"5 16 \* \* 6"/);
});

test("informa o mesmo horário no painel financeiro", () => {
  assert.match(finances, /Segunda a sexta: 18h\. Sábado: 13h\./);
  assert.doesNotMatch(finances, /Segunda a sexta: 17h\./);
});
