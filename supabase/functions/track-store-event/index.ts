import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const EVENT_TYPES = new Set(["session_started", "whatsapp_checkout"]);
const BASE_FIELDS = new Set(["event_type", "visitor_id", "session_id", "page_path"]);
const CHECKOUT_FIELDS = new Set([...BASE_FIELDS, "cart_item_count", "cart_total"]);
const BOT_PATTERN = /bot|crawler|spider|slurp|headless|lighthouse|pagespeed/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_BODY_BYTES = 2_048;
const REQUEST_IDS = new WeakMap<Request, string>();
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
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id",
    "Access-Control-Expose-Headers": "x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : allowedOrigins()[0],
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function requestId(request: Request) {
  const existing = REQUEST_IDS.get(request);
  if (existing) return existing;
  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  const resolved = REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
  REQUEST_IDS.set(request, resolved);
  return resolved;
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "X-Request-Id": requestId(request),
    },
  });
}

function uuid(value: unknown) {
  const text = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

Deno.serve(async (request) => {
  const startedAt = performance.now();
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders(request),
        "Cache-Control": "no-store",
        "X-Request-Id": requestId(request),
      },
    });
  }
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigins().includes(origin)) return json(request, { error: "Origem não permitida." }, 403);
  if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "")) return json(request, { ok: true, ignored: "bot" });

  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return json(request, { error: "Conteúdo deve ser JSON." }, 415);
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json(request, { error: "Conteúdo muito grande." }, 413);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json(request, { error: "Conteúdo muito grande." }, 413);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return json(request, { error: "JSON inválido." }, 400);
    }
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return json(request, { error: "Evento inválido." }, 400);
    }

    const body = parsedBody as Record<string, unknown>;
    const eventType = String(body.event_type ?? "");
    const visitorId = uuid(body.visitor_id);
    const sessionId = uuid(body.session_id);
    const pagePath = String(body.page_path ?? "").trim();
    if (!EVENT_TYPES.has(eventType) || !visitorId || !sessionId) return json(request, { error: "Evento inválido." }, 400);
    const allowedFields = eventType === "whatsapp_checkout" ? CHECKOUT_FIELDS : BASE_FIELDS;
    if (Object.keys(body).some((field) => !allowedFields.has(field))) {
      return json(request, { error: "Evento contém campos não permitidos." }, 400);
    }
    if (!pagePath.startsWith("/") || pagePath.length > 200) return json(request, { error: "Página inválida." }, 400);

    let cartItemCount: number | null = null;
    let cartTotal: number | null = null;
    if (eventType === "whatsapp_checkout") {
      const requestedItemCount = Number(body.cart_item_count);
      const requestedCartTotal = Number(body.cart_total);
      if (!Number.isInteger(requestedItemCount) || requestedItemCount < 1 || requestedItemCount > 500 || !Number.isFinite(requestedCartTotal) || requestedCartTotal < 0 || requestedCartTotal > 1_000_000) {
        return json(request, { error: "Resumo do carrinho inválido." }, 400);
      }
      cartItemCount = requestedItemCount;
      cartTotal = requestedCartTotal;
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
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      request_id: requestId(request),
      function: "track-store-event",
      status: 500,
      duration_ms: Math.round(performance.now() - startedAt),
      error: "store_event_insert_failed",
    }));
    return json(request, { error: "Não foi possível registrar a métrica." }, 500);
  }
});
