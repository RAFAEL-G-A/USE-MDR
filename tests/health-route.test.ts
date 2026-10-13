import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/health/route.ts";

test("health check expõe somente estado público mínimo", async () => {
  const response = GET();
  const body = await response.json() as {
    status: string;
    version: string;
    services: { app: string };
  };

  assert.equal(response.status, 200);
  assert.deepEqual(body.services, { app: "ok" });
  assert.equal(body.status, "ok");
  assert.equal(typeof body.version, "string");
  assert.equal(JSON.stringify(body).includes("SUPABASE"), false);
  assert.equal(JSON.stringify(body).includes("secret"), false);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=60/);
});
