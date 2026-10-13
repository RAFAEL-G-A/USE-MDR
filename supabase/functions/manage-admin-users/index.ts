import {
  assertInventoryAccess,
  assertOwner,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { writeAdminAudit } from "../_shared/admin-audit.ts";

const ROLES = new Set(["owner", "manager", "operator"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    await assertInventoryAccess(context);
    assertOwner(context);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "list") {
      const [{ data: users, error: usersError }, { data: auditLogs, error: auditError }] = await Promise.all([
        context.adminClient.from("admin_staff")
          .select("user_id, email, display_name, role, status, created_at, updated_at")
          .order("created_at", { ascending: true }),
        context.adminClient.from("admin_audit_logs")
          .select("id, created_at, user_id, action, resource_type, resource_id, result")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (usersError || auditError) throw usersError ?? auditError;
      const nameByUser = new Map((users ?? []).map((user) => [String(user.user_id), String(user.display_name)]));
      return json(request, {
        ok: true,
        users: users ?? [],
        audit_logs: (auditLogs ?? []).map((entry) => ({
          ...entry,
          user_name: entry.user_id ? nameByUser.get(String(entry.user_id)) ?? "Usuário removido" : "Sistema",
        })),
      });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const displayName = String(body.display_name ?? "").trim();
      const role = String(body.role ?? "operator");
      if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || displayName.length > 120 || !ROLES.has(role)) {
        return json(request, { error: "Informe nome, e-mail e função válidos." }, 400);
      }
      // A senha existe somente para criar a conta; o funcionário acessa por OTP.
      // Mantê-la abaixo do limite de 72 bytes do bcrypt evita falha no Supabase Auth.
      const temporaryPassword = `${crypto.randomUUID()}A1!`;
      const { data: created, error: createError } = await context.adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createError || !created.user) {
        if (createError?.message?.toLowerCase().includes("already")) {
          return json(request, { error: "Este e-mail já possui uma conta. Ative-o pelo suporte técnico." }, 409);
        }
        throw createError ?? new Error("Não foi possível criar a conta.");
      }
      const { error: staffError } = await context.adminClient.from("admin_staff").insert({
        user_id: created.user.id,
        email,
        display_name: displayName,
        role,
        status: "active",
        invited_by: context.user.id,
      });
      if (staffError) {
        await context.adminClient.auth.admin.deleteUser(created.user.id);
        throw staffError;
      }
      await writeAdminAudit(request, context, {
        action: "admin_user_change",
        resourceType: "admin_user",
        resourceId: created.user.id,
        result: "success",
        metadata: { operation: "create", role },
      });
      return json(request, { ok: true, user_id: created.user.id }, 201);
    }

    if (action === "update_status") {
      const userId = String(body.user_id ?? "");
      const status = String(body.status ?? "");
      if (!userId || !["active", "inactive"].includes(status)) return json(request, { error: "Alteração inválida." }, 400);
      if (userId === context.user.id && status === "inactive") return json(request, { error: "Você não pode desativar a própria conta." }, 400);
      const { data, error } = await context.adminClient
        .from("admin_staff")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .neq("role", "owner")
        .select("user_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(request, { error: "Usuário não encontrado ou protegido." }, 404);
      if (status === "inactive") {
        await context.adminClient.from("admin_verified_sessions").delete().eq("user_id", userId);
      }
      await writeAdminAudit(request, context, {
        action: "admin_user_change",
        resourceType: "admin_user",
        resourceId: userId,
        result: "success",
        metadata: { operation: "update_status", status },
      });
      return json(request, { ok: true });
    }

    return json(request, { error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível administrar os usuários.";
    return json(request, { error: message }, 401);
  }
});
