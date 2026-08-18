import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStoreDateTime,
  storeDateKey,
  storeDateTimeInputValue,
  storeInputToIso,
} from "../lib/store-time.ts";

test("exibe UTC no horário oficial da loja", () => {
  assert.equal(storeDateTimeInputValue("2026-08-18T18:27:00.000Z"), "2026-08-18T15:27");
  assert.match(formatStoreDateTime("2026-08-18T18:27:00.000Z"), /18\/08\/2026.*15:27/);
});

test("converte o horário informado na loja para UTC antes de salvar", () => {
  assert.equal(storeInputToIso("2026-08-18T15:27"), "2026-08-18T18:27:00.000Z");
});

test("mantém a data comercial de Recife perto da meia-noite UTC", () => {
  assert.equal(storeDateKey("2026-08-19T01:30:00.000Z"), "2026-08-18");
});

test("rejeita valores que não vieram de um campo data e hora", () => {
  assert.throws(() => storeInputToIso("18/08/2026 15:27"), /inválidas/);
});
