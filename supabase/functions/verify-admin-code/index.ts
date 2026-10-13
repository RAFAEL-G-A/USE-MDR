import {
  authenticateAdmin,
  constantTimeEqual,
  corsHeaders,
  hashCode,
  json,
} from "../_shared/admin-auth.ts";
import { writeAdminAudit } from "../_shared/admin-audit.ts";

const MAX_ATTEMPTS = 5;
const AUTHORIZATION_HOURS = 5;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    const { adminClient, sessionId, user } = context;
    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      await writeAdminAudit(request, context, {
        action: "admin_verification_failure",
        resourceType: "admin_session",
        result: "failure",
        metadata: { reason: "invalid_format" },
      });
      return json(request, { error: "Informe o código de seis dígitos." }, 400);
    }

    const now = new Date().toISOString();
    const { data: challenge, error: challengeError } = await adminClient
      .from("admin_email_challenges")
      .select("id, code_hash, attempts, expires_at")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError) throw challengeError;
    if (!challenge) {
      await writeAdminAudit(request, context, {
        action: "admin_verification_failure",
        resourceType: "admin_session",
        result: "failure",
        metadata: { reason: "expired_or_attempt_limit" },
      });
      return json(request, { error: "Código expirado ou limite de tentativas atingido." }, 403);
    }

    const nextAttempts = challenge.attempts + 1;
    const { data: reservedAttempt, error: attemptError } = await adminClient
      .from("admin_email_challenges")
      .update({ attempts: nextAttempts })
      .eq("id", challenge.id)
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .eq("attempts", challenge.attempts)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("attempts")
      .maybeSingle();

    if (attemptError) throw attemptError;
    if (!reservedAttempt) {
      await writeAdminAudit(request, context, {
        action: "admin_verification_failure",
        resourceType: "admin_session",
        result: "failure",
        metadata: { reason: "concurrent_attempt" },
      });
      return json(request, { error: "Outra tentativa já está sendo processada. Tente novamente." }, 409);
    }

    const candidateHash = await hashCode(user.id, sessionId, challenge.id, code);
    if (!constantTimeEqual(candidateHash, challenge.code_hash)) {
      const remaining = MAX_ATTEMPTS - nextAttempts;
      await writeAdminAudit(request, context, {
        action: "admin_verification_failure",
        resourceType: "admin_session",
        result: "failure",
        metadata: { reason: "invalid_code", remaining_attempts: remaining },
      });
      return json(
        request,
        { error: remaining > 0 ? `Código incorreto. Restam ${remaining} tentativas.` : "Limite de tentativas atingido." },
        403,
      );
    }

    const verifiedUntil = new Date(
      Date.now() + AUTHORIZATION_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const { error: sessionError } = await adminClient.from("admin_verified_sessions").upsert({
      user_id: user.id,
      session_id: sessionId,
      expires_at: verifiedUntil,
      verified_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,session_id",
    });
    if (sessionError) throw sessionError;

    await adminClient
      .from("admin_email_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    await writeAdminAudit(request, context, {
      action: "admin_verification_success",
      resourceType: "admin_session",
      result: "success",
    });

    return json(request, { ok: true, verifiedUntil });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível verificar o código.";
    return json(request, { error: message }, 401);
  }
});
