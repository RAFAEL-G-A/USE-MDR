import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import { corsHeaders, json } from "../_shared/admin-auth.ts";

const COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 10;
const GENERIC_SUCCESS = "Se o e-mail estiver autorizado, o código será enviado.";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(request, { error: "Informe um e-mail válido." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const emailFrom = Deno.env.get("EMAIL_FROM");
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return json(request, { error: "O serviço de acesso não foi configurado." }, 503);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: staff, error: staffError } = await adminClient
      .from("admin_staff")
      .select("user_id, display_name")
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();
    if (staffError) throw staffError;

    // A mesma resposta evita revelar quais e-mails fazem parte da equipe.
    if (!staff) return json(request, { ok: true, message: GENERIC_SUCCESS }, 202);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count, error: countError }, { data: latest, error: latestError }] = await Promise.all([
      adminClient.from("admin_login_otp_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", staff.user_id)
        .gte("requested_at", oneHourAgo),
      adminClient.from("admin_login_otp_requests")
        .select("requested_at")
        .eq("user_id", staff.user_id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (countError || latestError) throw countError ?? latestError;

    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return json(request, { error: "Limite de códigos atingido. Aguarde uma hora." }, 429);
    }
    if (latest) {
      const elapsedSeconds = (Date.now() - new Date(latest.requested_at).getTime()) / 1000;
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        return json(request, { error: "Aguarde um minuto antes de solicitar outro código." }, 429);
      }
    }

    const requestId = crypto.randomUUID();
    const { error: reservationError } = await adminClient.from("admin_login_otp_requests").insert({
      id: requestId,
      user_id: staff.user_id,
    });
    if (reservationError) throw reservationError;

    const { data: generated, error: generateError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const code = generated?.properties?.email_otp;
    if (generateError || !code) {
      await adminClient.from("admin_login_otp_requests").delete().eq("id", requestId);
      throw generateError ?? new Error("O código não pôde ser gerado.");
    }

    const displayName = escapeHtml(String(staff.display_name));
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `admin-login-${requestId}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Seu código de acesso | USE MDR",
        text: `Olá, ${staff.display_name}. Seu código de acesso administrativo à USE MDR é ${code}. Ele é de uso único. Se você não solicitou este acesso, ignore este e-mail.`,
        html: `<div style="margin:0;background:#fff7fa;padding:32px 16px;font-family:Arial,sans-serif;color:#2b2326"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #f8c9da;border-radius:24px;overflow:hidden"><div style="background:#ed1760;padding:24px;text-align:center;color:#ffffff"><div style="font-size:28px;font-weight:800;letter-spacing:.5px">USE MDR</div><div style="margin-top:6px;font-size:12px;letter-spacing:2px;text-transform:uppercase">Acesso administrativo</div></div><div style="padding:30px"><p style="margin:0 0 16px;font-size:16px">Olá, <strong>${displayName}</strong>.</p><p style="margin:0;color:#6e6065;line-height:1.6">Digite o código abaixo na tela de acesso ao painel:</p><div style="margin:26px 0;padding:20px;border-radius:18px;background:#fff0f5;text-align:center;color:#ed1760;font-size:36px;font-weight:800;letter-spacing:10px">${code}</div><p style="margin:0;color:#6e6065;font-size:14px;line-height:1.6">Este código é de uso único. Se você não solicitou este acesso, ignore este e-mail.</p></div><div style="border-top:1px solid #f8c9da;padding:18px;text-align:center;color:#9a858c;font-size:12px">Equipe USE MDR · Segurança do painel</div></div></div>`,
      }),
    });

    if (!emailResponse.ok) {
      const providerError = await emailResponse.json().catch(() => ({})) as { name?: string };
      console.error(JSON.stringify({
        event: "admin_login_email_failed",
        provider: "resend",
        status: emailResponse.status,
        providerError: String(providerError.name ?? "unknown").slice(0, 80),
      }));
      await adminClient.from("admin_login_otp_requests").delete().eq("id", requestId);
      throw new Error("O provedor não conseguiu enviar o e-mail.");
    }
    const providerResult = await emailResponse.json().catch(() => ({})) as { id?: string };
    if (providerResult.id) {
      await adminClient.from("admin_login_otp_requests")
        .update({ provider_message_id: providerResult.id })
        .eq("id", requestId);
    }

    await adminClient.from("admin_login_otp_requests").delete().lt("requested_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    return json(request, { ok: true, message: GENERIC_SUCCESS, retryAfterSeconds: COOLDOWN_SECONDS }, 202);
  } catch {
    return json(request, { error: "Não foi possível enviar o código agora. Tente novamente." }, 503);
  }
});
