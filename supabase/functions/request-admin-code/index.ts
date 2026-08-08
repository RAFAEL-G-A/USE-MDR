import {
  authenticateAdmin,
  corsHeaders,
  hashCode,
  json,
  randomSixDigitCode,
} from "../_shared/admin-auth.ts";

const CODE_LIFETIME_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const { adminClient, sessionId, user } = await authenticateAdmin(request);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await adminClient
      .from("admin_email_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countError) throw countError;
    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return json(request, { error: "Limite de códigos atingido. Aguarde uma hora." }, 429);
    }

    const { data: latest } = await adminClient
      .from("admin_email_challenges")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      const secondsSinceLastRequest = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
      if (secondsSinceLastRequest < RESEND_COOLDOWN_SECONDS) {
        return json(request, { error: "Aguarde um minuto antes de solicitar outro código." }, 429);
      }
    }

    const challengeId = crypto.randomUUID();
    const code = randomSixDigitCode();
    const codeHash = await hashCode(user.id, sessionId, challengeId, code);
    const expiresAt = new Date(Date.now() + CODE_LIFETIME_MINUTES * 60 * 1000).toISOString();
    const { error: insertError } = await adminClient.from("admin_email_challenges").insert({
      id: challengeId,
      user_id: user.id,
      session_id: sessionId,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (insertError) throw insertError;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    if (!resendApiKey || !emailFrom || !adminEmail) {
      throw new Error("O serviço de e-mail não foi configurado.");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `admin-code-${challengeId}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [adminEmail],
        subject: "Código de acesso ao inventário USE MDR",
        text: `Seu código de acesso é ${code}. Ele vence em ${CODE_LIFETIME_MINUTES} minutos. Se você não solicitou este código, altere sua senha.`,
        html: `<div style="font-family:Arial,sans-serif;color:#2b2326"><p>Seu código de acesso ao inventário da USE MDR é:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#e91e63">${code}</p><p>Ele vence em ${CODE_LIFETIME_MINUTES} minutos. Se você não solicitou este código, altere sua senha.</p></div>`,
      }),
    });

    if (!emailResponse.ok) {
      await adminClient.from("admin_email_challenges").delete().eq("id", challengeId);
      throw new Error("O provedor não conseguiu enviar o e-mail.");
    }

    return json(request, { ok: true, expiresInSeconds: CODE_LIFETIME_MINUTES * 60 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível enviar o código.";
    return json(request, { error: message }, 401);
  }
});
