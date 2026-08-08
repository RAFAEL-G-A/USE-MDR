import {
  authenticateAdmin,
  constantTimeEqual,
  corsHeaders,
  hashCode,
  json,
} from "../_shared/admin-auth.ts";

const MAX_ATTEMPTS = 5;
const AUTHORIZATION_MINUTES = 30;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const { adminClient, sessionId, user } = await authenticateAdmin(request);
    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return json(request, { error: "Informe o código de seis dígitos." }, 400);
    }

    const { data: challenge, error: challengeError } = await adminClient
      .from("admin_email_challenges")
      .select("id, code_hash, attempts, expires_at")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError) throw challengeError;
    if (!challenge || challenge.attempts >= MAX_ATTEMPTS) {
      return json(request, { error: "Código expirado ou limite de tentativas atingido." }, 403);
    }

    const nextAttempts = challenge.attempts + 1;
    await adminClient
      .from("admin_email_challenges")
      .update({ attempts: nextAttempts })
      .eq("id", challenge.id);

    const candidateHash = await hashCode(user.id, sessionId, challenge.id, code);
    if (!constantTimeEqual(candidateHash, challenge.code_hash)) {
      const remaining = MAX_ATTEMPTS - nextAttempts;
      return json(
        request,
        { error: remaining > 0 ? `Código incorreto. Restam ${remaining} tentativas.` : "Limite de tentativas atingido." },
        403,
      );
    }

    const verifiedUntil = new Date(Date.now() + AUTHORIZATION_MINUTES * 60 * 1000).toISOString();
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...user.app_metadata,
        inventory_email_verified_session_id: sessionId,
        inventory_email_verified_until: verifiedUntil,
      },
    });
    if (updateUserError) throw updateUserError;

    await adminClient
      .from("admin_email_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    return json(request, { ok: true, verifiedUntil });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível verificar o código.";
    return json(request, { error: message }, 401);
  }
});
