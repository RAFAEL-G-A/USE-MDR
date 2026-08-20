import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const EVENT_TYPES = new Set(["session_started", "whatsapp_checkout"]);
const BOT_PATTERN = /bot|crawler|spider|slurp|headless|lighthouse|pagespeed/i;
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "https://use-mdr-beauty.netlify.app",
  "https://use-mdr-beauty-preview.usemdr-web.workers.dev",
];

function allowedOrigins() {
  const configured = (Deno.env.get("PUBLIC_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : allowedOrigins()[0],
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function uuid(value: unknown) {
  const text = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigins().includes(origin)) return json(request, { error: "Origem não permitida." }, 403);
  if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "")) return json(request, { ok: true, ignored: "bot" });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const eventType = String(body.event_type ?? "");
    const visitorId = uuid(body.visitor_id);
    const sessionId = uuid(body.session_id);
    const pagePath = String(body.page_path ?? "").trim();
    if (!EVENT_TYPES.has(eventType) || !visitorId || !sessionId) return json(request, { error: "Evento inválido." }, 400);
    if (!pagePath.startsWith("/") || pagePath.length > 200) return json(request, { error: "Página inválida." }, 400);

    const cartItemCount = eventType === "whatsapp_checkout" ? Number(body.cart_item_count) : null;
    const cartTotal = eventType === "whatsapp_checkout" ? Number(body.cart_total) : null;
    if (eventType === "whatsapp_checkout" && (!Number.isInteger(cartItemCount) || cartItemCount < 1 || cartItemCount > 500 || !Number.isFinite(cartTotal) || cartTotal < 0 || cartTotal > 1_000_000)) {
      return json(request, { error: "Resumo do carrinho inválido." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Métricas não configuradas.");
    const client = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.from("store_analytics_events").insert({
      event_type: eventType,
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: pagePath,
      cart_item_count: cartItemCount,
      cart_total: cartTotal,
    });
    if (error && error.code !== "23505") throw error;
    return json(request, { ok: true, deduplicated: error?.code === "23505" }, error ? 200 : 201);
  } catch {
    return json(request, { error: "Não foi possível registrar a métrica." }, 500);
  }
});
