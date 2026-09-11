"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Staff = { user_id: string; email: string; display_name: string; role: "owner" | "manager" | "operator"; status: "active" | "inactive" };
type AuditLog = { id: number; created_at: string; user_name: string; action: string; resource_type: string; resource_id: string | null; result: "success" | "failure" };
const roleNames = { owner: "Proprietária", manager: "Gerente", operator: "Operador" } as const;
const actionNames: Record<string, string> = {
  create_product: "Cadastrou produto", update_product: "Alterou produto", delete_product: "Excluiu produto",
  stock_change: "Alterou estoque", inventory_acquisition: "Registrou aquisição", create_sale: "Registrou venda",
  update_sale: "Corrigiu venda", delete_sale: "Cancelou venda", financial_change: "Alterou finanças",
  hero_change: "Alterou destaques", category_change: "Alterou categorias", image_change: "Alterou imagem",
  admin_user_change: "Alterou usuário", admin_verification_success: "Validou acesso", admin_verification_failure: "Falhou na validação",
};

async function functionError(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminUsers() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [users, setUsers] = useState<Staff[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-admin-users", { body: { action: "list" } });
    if (error) setFeedback({ type: "error", message: await functionError(error, "Não foi possível carregar os usuários.") });
    else { setUsers(data?.users ?? []); setAuditLogs(data?.audit_logs ?? []); }
    setLoading(false);
  }
  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback(null);
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.functions.invoke("manage-admin-users", { body: { action: "create", display_name: form.get("display_name"), email: form.get("email"), role: form.get("role") } });
    if (error) setFeedback({ type: "error", message: await functionError(error, "Não foi possível criar o usuário.") });
    else { setFeedback({ type: "success", message: "Funcionário autorizado. Ele já pode solicitar o OTP no próprio e-mail." }); event.currentTarget.reset(); await refresh(); }
    setSaving(false);
  }

  async function toggleStatus(user: Staff) {
    setFeedback(null);
    const status = user.status === "active" ? "inactive" : "active";
    const { error } = await supabase.functions.invoke("manage-admin-users", { body: { action: "update_status", user_id: user.user_id, status } });
    if (error) setFeedback({ type: "error", message: await functionError(error, "Não foi possível alterar o acesso.") });
    else { setFeedback({ type: "success", message: status === "active" ? "Acesso reativado." : "Acesso desativado e sessões revogadas." }); await refresh(); }
  }

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">EQUIPE</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">Usuários do painel</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Autorize o e-mail de cada funcionário. Depois disso, ele solicita o próprio código e suas alterações ficam identificadas no histórico.</p>
      <form onSubmit={createUser} className="mt-7 grid gap-4 sm:grid-cols-3">
        <Field label="Nome"><input name="display_name" required minLength={2} maxLength={120} className="form-control" /></Field>
        <Field label="E-mail"><input name="email" type="email" required className="form-control" /></Field>
        <Field label="Função"><select name="role" defaultValue="operator" className="form-control"><option value="operator">Operador</option><option value="manager">Gerente</option></select></Field>
        <button disabled={saving} className="min-h-12 rounded-full bg-brand px-6 text-sm font-extrabold text-white disabled:opacity-60 sm:col-span-3">{saving ? "AUTORIZANDO..." : "AUTORIZAR FUNCIONÁRIO"}</button>
      </form>
      {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.message}</p>}
    </section>
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8"><h2 className="font-serif text-3xl">Acessos cadastrados</h2>{loading ? <p className="mt-5 text-sm text-muted">Carregando...</p> : <div className="mt-5 space-y-3">{users.map((user) => <article key={user.user_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-border p-4"><div><p className="text-sm font-extrabold">{user.display_name}</p><p className="mt-1 text-xs text-muted">{user.email} · {roleNames[user.role]} · {user.status === "active" ? "Ativo" : "Inativo"}</p></div>{user.role !== "owner" && <button type="button" onClick={() => void toggleStatus(user)} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand">{user.status === "active" ? "Desativar" : "Reativar"}</button>}</article>)}</div>}</section>
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8"><h2 className="font-serif text-3xl">Atividade da equipe</h2><p className="mt-2 text-sm text-muted">Últimas alterações identificadas por usuário.</p>{auditLogs.length === 0 ? <p className="mt-5 text-sm text-muted">Nenhuma alteração registrada.</p> : <div className="mt-5 divide-y divide-brand-border">{auditLogs.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><p className="text-sm"><strong>{entry.user_name}</strong> · {actionNames[entry.action] ?? entry.action}</p><div className="text-right"><p className={`text-xs font-bold ${entry.result === "success" ? "text-emerald-700" : "text-red-600"}`}>{entry.result === "success" ? "Concluído" : "Falhou"}</p><p className="mt-1 text-xs text-muted">{new Date(entry.created_at).toLocaleString("pt-BR")}</p></div></div>)}</div>}</section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-extrabold uppercase tracking-[0.1em]"><span className="mb-2 block">{label}</span>{children}</label>; }
