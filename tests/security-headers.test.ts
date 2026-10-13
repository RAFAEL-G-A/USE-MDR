import assert from "node:assert/strict";
import test from "node:test";
import { createSecurityHeaders } from "../lib/security-headers.ts";

function asMap(headers: ReturnType<typeof createSecurityHeaders>) {
  return new Map(headers.map(({ key, value }) => [key, value]));
}

test("configura os headers de segurança globais", () => {
  const headers = asMap(createSecurityHeaders({ isDevelopment: false, isProduction: true }));

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.match(headers.get("Permissions-Policy") ?? "", /camera=\(\)/);
  assert.match(headers.get("Strict-Transport-Security") ?? "", /^max-age=/);
});

test("a CSP preserva Supabase, imagens e analytics sem liberar frames", () => {
  const csp = asMap(createSecurityHeaders({ isDevelopment: false, isProduction: true })).get("Content-Security-Policy") ?? "";

  assert.match(csp, /connect-src[^;]*https:\/\/\*\.supabase\.co/);
  assert.match(csp, /connect-src[^;]*wss:\/\/\*\.supabase\.co/);
  assert.match(csp, /img-src[^;]*https:\/\/\*\.supabase\.co/);
  assert.match(csp, /static\.cloudflareinsights\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
});

test("desenvolvimento permite avaliação do runtime e não força HSTS", () => {
  const headers = asMap(createSecurityHeaders({ isDevelopment: true, isProduction: false }));

  assert.match(headers.get("Content-Security-Policy") ?? "", /'unsafe-eval'/);
  assert.equal(headers.has("Strict-Transport-Security"), false);
});
