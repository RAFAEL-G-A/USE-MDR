import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.112.2";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "https://use-mdr-beauty.netlify.app",
];

const requestIds = new WeakMap<Request, string>();

export function requestId(request: Request) {
  const existing = requestIds.get(request);
  if (existing) return existing;

  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  const id = /^[A-Za-z0-9._-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID();
  requestIds.set(request, id);
  return id;
}

export type AdminContext = {
  adminClient: SupabaseClient;
  authMethods: string[];
  sessionId: string;
  staff: {
    displayName: string;
    role: "owner" | "manager" | "operator";
  };
  user: User;
};

export type AdminRole = AdminContext["staff"]["role"];
export type AdminSection =
  | "inventory"
  | "acquisitions"
  | "categories"
  | "sales"
  | "highlights"
  | "finances"
  | "analytics"
  | "users";

const ROLE_SECTIONS: Record<AdminRole, readonly AdminSection[]> = {
  owner: ["inventory", "acquisitions", "categories", "sales", "highlights", "finances", "analytics", "users"],
  manager: ["inventory", "acquisitions", "categories", "sales", "highlights", "analytics"],
  operator: ["sales"],
};

export function adminSectionsForRole(role: AdminRole) {
  return [...ROLE_SECTIONS[role]];
}

export function assertAdminSection(context: AdminContext, section: AdminSection) {
  if (!ROLE_SECTIONS[context.staff.role].includes(section)) {
    throw new Error("Sua função não possui permissão para acessar esta área.");
  }
}

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
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "X-Request-Id": requestId(request),
    },
  });
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Token inválido.");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { session_id?: string; amr?: Array<{ method?: string }> };
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

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("A função administrativa não foi configurada.");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient.auth.getUser(token);
  const user = data.user;

  if (error || !user?.email) throw new Error("Sessão inválida ou expirada.");

  const normalizedEmail = user.email.trim().toLowerCase();
  let { data: staff, error: staffError } = await adminClient
    .from("admin_staff")
    .select("display_name, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // Compatibilidade segura para a proprietária já existente. Depois da primeira
  // autenticação, a autorização passa a existir na tabela da equipe.
  if (!staff && !staffError && adminEmail && normalizedEmail === adminEmail && user.app_metadata?.role === "admin") {
    const { data: bootstrapped, error: bootstrapError } = await adminClient
      .from("admin_staff")
      .upsert({
        user_id: user.id,
        email: normalizedEmail,
        display_name: user.user_metadata?.display_name || "Proprietária",
        role: "owner",
        status: "active",
      })
      .select("display_name, role, status")
      .single();
    staff = bootstrapped;
    staffError = bootstrapError;
  }

  if (staffError || !staff || staff.status !== "active") {
    throw new Error("Esta conta não possui acesso administrativo ativo.");
  }

  const jwtPayload = decodeJwtPayload(token);
  const sessionId = jwtPayload.session_id;
  if (!sessionId) throw new Error("A sessão não possui um identificador válido.");

  return {
    adminClient,
    authMethods: (jwtPayload.amr ?? []).map((entry) => String(entry.method ?? "")).filter(Boolean),
    sessionId,
    staff: {
      displayName: String(staff.display_name),
      role: staff.role as AdminContext["staff"]["role"],
    },
    user,
  };
}

export function assertOwner(context: AdminContext) {
  if (context.staff.role !== "owner") {
    throw new Error("Somente a proprietária pode administrar usuários.");
  }
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
