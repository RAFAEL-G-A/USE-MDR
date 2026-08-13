import assert from "node:assert/strict";
import test from "node:test";
import { dueFinancialPeriods } from "../supabase/functions/_shared/financial-periods.ts";

test("gera somente o fechamento diário em uma segunda-feira comum", () => {
  assert.deepEqual(dueFinancialPeriods(new Date("2026-08-10T20:05:00Z")), [
    { type: "daily", start: "2026-08-10", end: "2026-08-10" },
  ]);
});

test("gera fechamento diário e semanal no sábado", () => {
  assert.deepEqual(dueFinancialPeriods(new Date("2026-08-15T16:05:00Z")), [
    { type: "daily", start: "2026-08-15", end: "2026-08-15" },
    { type: "weekly", start: "2026-08-10", end: "2026-08-15" },
  ]);
});

test("gera fechamento mensal no último dia comercial", () => {
  assert.deepEqual(dueFinancialPeriods(new Date("2026-08-31T20:05:00Z")), [
    { type: "daily", start: "2026-08-31", end: "2026-08-31" },
    { type: "monthly", start: "2026-08-01", end: "2026-08-31" },
  ]);
});

test("não agenda fechamento no domingo", () => {
  assert.deepEqual(dueFinancialPeriods(new Date("2026-08-16T16:05:00Z")), []);
});
