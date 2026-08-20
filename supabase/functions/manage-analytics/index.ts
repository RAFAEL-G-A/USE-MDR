import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    await assertInventoryAccess(context);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const start = String(body.start ?? "");
    const end = String(body.end ?? "");
    if (!validDate(start) || !validDate(end)) return json(request, { error: "Período inválido." }, 400);
    const duration = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
    if (duration < 0 || duration > 92) return json(request, { error: "Escolha um período de até 93 dias." }, 400);

    const { data, error } = await context.adminClient.rpc("get_store_analytics", {
      p_period_start: start,
      p_period_end: end,
    });
    if (error) throw new Error(`Não foi possível carregar as métricas: ${error.message}`);
    const metrics = (data ?? {}) as Record<string, unknown>;
    return json(request, { ok: true, range: { start, end }, ...metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar as métricas.";
    return json(request, { error: message }, 401);
  }
});
