import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.112.2";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "https://use-mdr-beauty.netlify.app",
];

export type AdminContext = {
  adminClient: SupabaseClient;
  sessionId: string;
  user: User;
};

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const configuredOrigins = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length ? configuredOrigins : DEFAULT_ORIGINS;
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

export function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Token inválido.");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { session_id?: string };
}

export async function authenticateAdmin(request: Request): Promise<AdminContext> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Acesso não autenticado.");
  }

  const token = authorization.slice("Bearer ".length);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL")?.trim().toLowerCase();

  if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
    throw new Error("A função administrativa não foi configurada.");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient.auth.getUser(token);
  const user = data.user;

  if (error || !user) throw new Error("Sessão inválida ou expirada.");
  if (user.email?.toLowerCase() !== adminEmail || user.app_metadata?.role !== "admin") {
    throw new Error("Esta conta não possui acesso administrativo.");
  }

  const sessionId = decodeJwtPayload(token).session_id;
  if (!sessionId) throw new Error("A sessão não possui um identificador válido.");

  return { adminClient, sessionId, user };
}

export async function getInventoryAccess(context: AdminContext) {
  const { data, error } = await context.adminClient
    .from("admin_verified_sessions")
    .select("expires_at")
    .eq("user_id", context.user.id)
    .eq("session_id", context.sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  return data?.expires_at ? { verifiedUntil: data.expires_at } : null;
}

export async function assertInventoryAccess(context: AdminContext) {
  if (!(await getInventoryAccess(context))) {
    throw new Error("Confirme o código enviado por e-mail antes de alterar o inventário.");
  }
}

export async function hashCode(userId: string, sessionId: string, challengeId: string, code: string) {
  const pepper = Deno.env.get("OTP_PEPPER");
  if (!pepper || pepper.length < 32) {
    throw new Error("O segredo de verificação não foi configurado.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${sessionId}:${challengeId}:${code}`),
  );

  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function randomSixDigitCode() {
  const range = 1_000_000;
  const maximum = Math.floor(0x1_0000_0000 / range) * range;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= maximum);
  return String(values[0] % range).padStart(6, "0");
}
