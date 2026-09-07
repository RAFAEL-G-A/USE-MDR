import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../r48.manifest.json", import.meta.url), "utf8")) as {
  store: string;
  architectureVersion: number;
  appVersion: string;
  healthContract: string;
  capabilities: Array<{ name: string; version: string }>;
};

test("manifesto R48 é versionado e contém as capabilities esperadas", () => {
  const expected = ["admin-auth", "catalog", "products", "inventory", "cart", "favorites", "whatsapp", "sales", "finance", "analytics", "categories", "hero", "image-management"];
  assert.equal(manifest.store, "use-mdr");
  assert.equal(manifest.architectureVersion, 1);
  assert.match(manifest.appVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.healthContract, "/api/health");
  assert.deepEqual(manifest.capabilities.map(({ name }) => name), expected);
  assert.equal(new Set(manifest.capabilities.map(({ name }) => name)).size, expected.length);
  for (const capability of manifest.capabilities) assert.match(capability.version, /^\d+\.\d+\.\d+$/);
});

test("manifesto não contém credenciais ou endereços internos", () => {
  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /token|secret|password|service_role|supabase\.co/i);
  assert.doesNotMatch(serialized, /https?:\/\//i);
});
