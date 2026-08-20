import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("o painel usa menu lateral recolhível em vez de cinco caixas superiores", () => {
  const shell = source("../components/admin-shell.tsx");
  const navigation = source("../components/admin-navigation.tsx");
  const layout = source("../app/admin/layout.tsx");

  assert.match(layout, /<AdminShell>/);
  assert.match(shell, /Abrir menu administrativo/);
  assert.match(shell, /Recolher menu administrativo/);
  assert.doesNotMatch(navigation, /grid-cols-5/);
});

test("finanças e métricas mantêm cartões equilibrados sem proporção lateral desigual", () => {
  const finances = source("../components/admin-finances.tsx");
  const analytics = source("../components/admin-analytics.tsx");

  assert.match(finances, /grid items-stretch gap-5 xl:grid-cols-2/);
  assert.match(analytics, /grid items-stretch gap-5 xl:grid-cols-2/);
  assert.doesNotMatch(analytics, /1\.4fr_0\.6fr/);
});
