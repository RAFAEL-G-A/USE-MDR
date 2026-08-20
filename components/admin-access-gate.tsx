"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError, type Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Feedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const user = session?.user ?? null;

  useEffect(() => {
    let cancelled = false;

    async function synchronizeAccess(nextSession: Session | null) {
      if (cancelled) return;
      setSession(nextSession);
      setCheckingSession(false);
      if (!nextSession) {
        setEmailVerified(false);
        setCheckingAccess(false);
        return;
      }

      setCheckingAccess(true);
      const { data, error } = await supabase.functions.invoke("check-admin-access", { body: {} });
      if (cancelled) return;
      setEmailVerified(!error && data?.authorized === true);
      setCheckingAccess(false);
    }

    void supabase.auth.getSession().then(({ data }) => synchronizeAccess(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void synchronizeAccess(nextSession), 0);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthenticating(true);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setFeedback({ type: "error", message: "Não foi possível entrar. Confira o e-mail e a senha." });
    setAuthenticating(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" });
    setEmailVerified(false);
    setCodeSent(false);
    setFeedback(null);
  }

  async function handleRequestCode() {
    setRequestingCode(true);
    setFeedback(null);
    const { error } = await supabase.functions.invoke("request-admin-code", { body: {} });
    if (error) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível enviar o código.") });
    } else {
      setCodeSent(true);
      setFeedback({ type: "success", message: "Código enviado. Verifique a caixa de entrada e a pasta de spam." });
    }
    setRequestingCode(false);
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyingCode(true);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") ?? "").trim();
    const { data, error } = await supabase.functions.invoke("verify-admin-code", { body: { code } });
    if (error) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Código inválido ou expirado.") });
      setVerifyingCode(false);
      return;
    }
    if (data?.ok !== true) {
      setFeedback({ type: "error", message: "O código foi aceito, mas a autorização não pôde ser confirmada. Tente novamente." });
    } else {
      setEmailVerified(true);
      setCodeSent(false);
      setFeedback(null);
    }
    setVerifyingCode(false);
  }

  if (checkingSession || checkingAccess) return <AccessCard><p className="text-sm text-muted">Verificando acesso administrativo...</p></AccessCard>;

  if (!user) {
    return (
      <AccessCard>
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">ACESSO RESTRITO</p>
        <h1 className="mt-2 font-serif text-3xl">Entrar como administradora</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Use a conta administrativa do Supabase. O e-mail não é exibido às clientes.</p>
        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <GateField label="E-mail" htmlFor="admin-email"><input id="admin-email" name="email" type="email" autoComplete="username" required className="form-control" placeholder="voce@exemplo.com" /></GateField>
          <GateField label="Senha" htmlFor="admin-password"><input id="admin-password" name="password" type="password" autoComplete="current-password" required minLength={8} className="form-control" placeholder="Sua senha administrativa" /></GateField>
          {feedback && <FeedbackMessage feedback={feedback} />}
          <button type="submit" disabled={authenticating} className="min-h-13 w-full rounded-full bg-brand px-6 text-sm font-extrabold text-white shadow-lg shadow-brand/20 disabled:opacity-60">{authenticating ? "ENTRANDO..." : "ENTRAR"}</button>
        </form>
      </AccessCard>
    );
  }

  if (!emailVerified) {
    return (
      <AccessCard>
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">SEGUNDA CAMADA</p>
        <h1 className="mt-2 font-serif text-3xl">Confirme o código do e-mail</h1>
        <p className="mt-3 text-sm leading-6 text-muted">A senha foi aceita. Enviaremos um código de seis dígitos para {user.email}.</p>
        {!codeSent ? (
          <button type="button" onClick={handleRequestCode} disabled={requestingCode} className="mt-7 min-h-13 w-full rounded-full bg-brand px-6 text-sm font-extrabold text-white disabled:opacity-60">{requestingCode ? "ENVIANDO..." : "ENVIAR CÓDIGO POR E-MAIL"}</button>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-7 space-y-5">
            <GateField label="Código de seis dígitos" htmlFor="admin-code"><input id="admin-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} pattern="[0-9]{6}" className="form-control text-center text-2xl font-bold tracking-[0.35em]" placeholder="000000" /></GateField>
            <button type="submit" disabled={verifyingCode} className="min-h-13 w-full rounded-full bg-brand px-6 text-sm font-extrabold text-white disabled:opacity-60">{verifyingCode ? "VERIFICANDO..." : "CONFIRMAR CÓDIGO"}</button>
            <button type="button" onClick={handleRequestCode} disabled={requestingCode} className="w-full text-xs font-bold text-brand">Enviar outro código</button>
          </form>
        )}
        {feedback && <div className="mt-5"><FeedbackMessage feedback={feedback} /></div>}
        <button type="button" onClick={handleLogout} className="mt-5 w-full text-xs font-bold text-muted">Sair da conta</button>
      </AccessCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border bg-white px-5 py-4 shadow-sm">
        <div><p className="text-xs font-bold text-brand">Acesso administrativo autorizado</p><p className="mt-1 text-xs text-muted">{user.email}</p></div>
        <button type="button" onClick={handleLogout} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand hover:bg-brand-soft">Sair</button>
      </div>
      {children}
    </div>
  );
}

function AccessCard({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-xl rounded-[2rem] border border-brand-border bg-white p-6 shadow-soft sm:p-8">{children}</section>;
}

function GateField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="text-xs font-extrabold uppercase tracking-[0.1em] text-foreground">{label}</label><div className="mt-2">{children}</div></div>;
}

function FeedbackMessage({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.message}</p>;
}
