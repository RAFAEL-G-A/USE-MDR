import {
  authenticateAdmin,
  corsHeaders,
  getInventoryAccess,
  json,
} from "../_shared/admin-auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    const access = await getInventoryAccess(context);
    return json(request, {
      authorized: Boolean(access),
      verifiedUntil: access?.verifiedUntil ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível verificar o acesso.";
    return json(request, { error: message }, 401);
  }
});
