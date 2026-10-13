import {
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { writeAdminAudit } from "../_shared/admin-audit.ts";

// Mantém a duração já adotada pela segunda camada administrativa.
const AUTHORIZATION_HOURS = 5;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    if (!context.authMethods.includes("otp")) {
      return json(request, { error: "Esta sessão não foi autenticada por código de e-mail." }, 403);
    }
    const verifiedUntil = new Date(Date.now() + AUTHORIZATION_HOURS * 60 * 60 * 1000).toISOString();
    const { error } = await context.adminClient.from("admin_verified_sessions").upsert({
      user_id: context.user.id,
      session_id: context.sessionId,
      expires_at: verifiedUntil,
      verified_at: new Date().toISOString(),
    }, { onConflict: "user_id,session_id" });
    if (error) throw error;

    await writeAdminAudit(request, context, {
      action: "admin_verification_success",
      resourceType: "admin_session",
      result: "success",
      metadata: { method: "supabase_email_otp" },
    });
    return json(request, { ok: true, verifiedUntil });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível autorizar a sessão.";
    return json(request, { error: message }, 401);
  }
});
