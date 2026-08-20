import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const verificationSource = readFileSync(
  new URL("../supabase/functions/verify-admin-code/index.ts", import.meta.url),
  "utf8",
);

const authorizationSource = readFileSync(
  new URL("../supabase/functions/_shared/admin-auth.ts", import.meta.url),
  "utf8",
);

test("a segunda verificação administrativa autoriza cinco horas", () => {
  assert.match(verificationSource, /const AUTHORIZATION_HOURS = 5;/);
  assert.match(
    verificationSource,
    /AUTHORIZATION_HOURS \* 60 \* 60 \* 1000/,
  );
});

test("a autorização continua vinculada à sessão e ao prazo no servidor", () => {
  assert.match(authorizationSource, /\.eq\("session_id", context\.sessionId\)/);
  assert.match(authorizationSource, /\.gt\("expires_at", new Date\(\)\.toISOString\(\)\)/);
});
