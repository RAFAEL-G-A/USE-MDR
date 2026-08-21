import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const protectedFunctions = [
  "check-admin-access",
  "create-product",
  "manage-analytics",
  "manage-category-image",
  "manage-catalog-categories",
  "manage-finances",
  "manage-hero-slide",
  "manage-product",
  "manage-sales",
  "request-admin-code",
  "verify-admin-code",
] as const;

const inventoryFunctions = protectedFunctions.filter((name) => ![
  "check-admin-access",
  "request-admin-code",
  "verify-admin-code",
].includes(name));

function functionSource(name: string) {
  return readFileSync(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (["node_modules", ".git", ".next", ".open-next"].includes(name)) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

test("todas as APIs administrativas validam o usuário no servidor", () => {
  for (const name of protectedFunctions) {
    const source = functionSource(name);
    assert.match(source, /request\.method !== "POST"/, `${name} deve recusar outros métodos`);
    assert.match(source, /await authenticateAdmin\(request\)/, `${name} deve autenticar o administrador`);
  }
});

test("toda API que lê ou altera dados privados exige a segunda verificação", () => {
  for (const name of inventoryFunctions) {
    assert.match(
      functionSource(name),
      /await assertInventoryAccess\(/,
      `${name} deve exigir o código por e-mail`,
    );
  }
});

test("a rotina de relatórios exige um segredo forte e não aceita GET", () => {
  const source = functionSource("run-financial-reports");
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /expectedSecret\.length < 32/);
  assert.match(source, /suppliedSecret !== expectedSecret/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_/);
});

test("a API pública de métricas limita origem, formato, robôs e duplicidade", () => {
  const source = functionSource("track-store-event");
  const migration = readFileSync(new URL("../supabase/migrations/20260819133000_store_analytics.sql", import.meta.url), "utf8");
  assert.match(source, /allowedOrigins\(\)\.includes\(origin\)/);
  assert.match(source, /BOT_PATTERN\.test/);
  assert.match(source, /EVENT_TYPES\.has\(eventType\)/);
  assert.match(source, /cartItemCount < 1 \|\| cartItemCount > 500/);
  assert.match(source, /cartTotal < 0 \|\| cartTotal > 1_000_000/);
  assert.match(migration, /unique \(session_id, event_type\)/i);
});

test("arquivos públicos e versionados não contêm chaves privadas", () => {
  const roots = ["app", "components", "lib", "public", "supabase/functions"];
  const files = roots.flatMap((root) => sourceFiles(root));
  const content = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(content, /sbp_[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /sb_secret_[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  assert.doesNotMatch(content, /NEXT_PUBLIC_[A-Z0-9_]*(ADMIN|SECRET|SERVICE_ROLE|PASSWORD)/);

  const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
