import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requestLoginOtp = readFileSync("supabase/functions/request-admin-login-otp/index.ts", "utf8");
const accessGate = readFileSync("components/admin-access-gate.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260909213155_add_admin_login_otp_requests.sql", "utf8");

test("login gera OTP no Supabase e entrega pelo Resend", () => {
  assert.match(requestLoginOtp, /auth\.admin\.generateLink/);
  assert.match(requestLoginOtp, /properties\?\.email_otp/);
  assert.match(requestLoginOtp, /https:\/\/api\.resend\.com\/emails/);
  assert.match(accessGate, /request-admin-login-otp/);
  assert.doesNotMatch(accessGate, /auth\.signInWithOtp/);
});

test("e-mail de acesso usa identidade USE MDR sem link mágico", () => {
  assert.match(requestLoginOtp, /Seu código de acesso \| USE MDR/);
  assert.match(requestLoginOtp, /background:#ed1760/);
  assert.match(requestLoginOtp, /Equipe USE MDR · Segurança do painel/);
  assert.doesNotMatch(requestLoginOtp, /action_link|localhost/);
});

test("endpoint público limita reenvios e não enumera funcionários", () => {
  assert.match(requestLoginOtp, /COOLDOWN_SECONDS = 60/);
  assert.match(requestLoginOtp, /MAX_REQUESTS_PER_HOUR = 10/);
  assert.match(requestLoginOtp, /A mesma resposta evita revelar/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* from public, anon, authenticated/i);
});

test("falha do Resend registra somente metadados técnicos seguros", () => {
  assert.match(requestLoginOtp, /admin_login_email_failed/);
  assert.match(requestLoginOtp, /providerError: String\(providerError\.name/);
  assert.doesNotMatch(requestLoginOtp, /console\.error\([^\n]*(email|code|message)/i);
});
