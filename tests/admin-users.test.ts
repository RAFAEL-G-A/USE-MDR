import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260909144734_add_inventory_acquisitions_and_admin_staff.sql", "utf8");
const auth = readFileSync("supabase/functions/_shared/admin-auth.ts", "utf8");
const requestCode = readFileSync("supabase/functions/request-admin-code/index.ts", "utf8");
const manageUsers = readFileSync("supabase/functions/manage-admin-users/index.ts", "utf8");
const authorizeOtp = readFileSync("supabase/functions/authorize-admin-session/index.ts", "utf8");
const accessCheck = readFileSync("supabase/functions/check-admin-access/index.ts", "utf8");
const navigation = readFileSync("components/admin-navigation.tsx", "utf8");

test("equipe administrativa fica fechada aos clientes públicos", () => {
  assert.match(migration, /alter table public\.admin_staff enable row level security/i);
  assert.match(migration, /revoke all on table public\.admin_staff from public, anon, authenticated/i);
  assert.match(auth, /\.from\("admin_staff"\)/);
  assert.match(auth, /staff\.status !== "active"/);
});

test("OTP administrativo é enviado ao e-mail do próprio usuário", () => {
  assert.match(requestCode, /const destinationEmail = user\.email/);
  assert.match(requestCode, /to: \[destinationEmail\]/);
  assert.doesNotMatch(requestCode, /to: \[adminEmail\]/);
});

test("sessão simplificada só é autorizada quando o JWT confirma autenticação por OTP", () => {
  assert.match(auth, /amr\?: Array/);
  assert.match(authorizeOtp, /authMethods\.includes\("otp"\)/);
});

test("somente a proprietária administra funcionários e a desativação revoga sessões", () => {
  assert.match(manageUsers, /assertOwner\(context\)/);
  assert.match(manageUsers, /\.from\("admin_verified_sessions"\)\.delete\(\)\.eq\("user_id", userId\)/);
  assert.match(manageUsers, /userId === context\.user\.id/);
});

test("senha temporária da conta permanece abaixo do limite do bcrypt", () => {
  assert.match(manageUsers, /const temporaryPassword = `\$\{crypto\.randomUUID\(\)\}A1!`;/);
  assert.doesNotMatch(manageUsers, /randomUUID\(\).*randomUUID\(\)/);
});

test("a aba de usuários recebe o histórico identificado de alterações", () => {
  assert.match(manageUsers, /\.from\("admin_audit_logs"\)/);
  assert.match(manageUsers, /user_name:/);
  assert.match(manageUsers, /\.limit\(100\)/);
});

test("papéis administrativos recebem apenas as áreas previstas", () => {
  assert.match(auth, /owner: \["inventory", "acquisitions", "categories", "sales", "highlights", "finances", "analytics", "users"\]/);
  assert.match(auth, /manager: \["inventory", "acquisitions", "categories", "sales", "highlights", "analytics"\]/);
  assert.match(auth, /operator: \["sales"\]/);
  assert.match(auth, /assertAdminSection/);
  assert.match(accessCheck, /adminSectionsForRole\(context\.staff\.role\)/);
  assert.match(accessCheck, /displayName: access \? context\.staff\.displayName : null/);
  assert.match(navigation, /profile\.sections\.includes\(item\.section\)/);
});

test("cada página administrativa declara a permissão que exige", () => {
  const routes = {
    estoque: "inventory",
    aquisicoes: "acquisitions",
    categorias: "categories",
    vendas: "sales",
    destaques: "highlights",
    financas: "finances",
    metricas: "analytics",
    usuarios: "users",
  } as const;

  for (const [route, section] of Object.entries(routes)) {
    const page = readFileSync(`app/admin/${route}/page.tsx`, "utf8");
    assert.match(page, new RegExp(`AdminAccessGate section=["']${section}["']`));
  }
});
