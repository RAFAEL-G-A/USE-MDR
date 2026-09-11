import {
  adminSectionsForRole,
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
      displayName: access ? context.staff.displayName : null,
      role: access ? context.staff.role : null,
      sections: access ? adminSectionsForRole(context.staff.role) : [],
      verifiedUntil: access?.verifiedUntil ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível verificar o acesso.";
    return json(request, { error: message }, 401);
  }
});
