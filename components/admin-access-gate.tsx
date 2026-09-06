"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import { FunctionsHttpError, type Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Feedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

const ADMIN_CODE_LENGTH = 6;

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
  const [codeDigits, setCodeDigits] = useState(() => Array<string>(ADMIN_CODE_LENGTH).fill(""));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
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
      setCodeDigits(Array<string>(ADMIN_CODE_LENGTH).fill(""));
      setFeedback({ type: "success", message: "Código enviado. Verifique a caixa de entrada e a pasta de spam." });
      window.setTimeout(() => codeInputRefs.current[0]?.focus(), 0);
    }
    setRequestingCode(false);
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyingCode(true);
    setFeedback(null);
    const code = codeDigits.join("");
    if (code.length !== ADMIN_CODE_LENGTH) {
      setFeedback({ type: "error", message: "Digite os seis números do código." });
      setVerifyingCode(false);
      return;
    }
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

  function distributeCode(startIndex: number, value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, ADMIN_CODE_LENGTH - startIndex);
    if (!numbers) return;
    setCodeDigits((current) => {
      const next = [...current];
      numbers.split("").forEach((number, offset) => { next[startIndex + offset] = number; });
      return next;
    });
    const nextIndex = Math.min(startIndex + numbers.length, ADMIN_CODE_LENGTH - 1);
    window.setTimeout(() => codeInputRefs.current[nextIndex]?.focus(), 0);
  }

  function handleCodeKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) codeInputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) codeInputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < ADMIN_CODE_LENGTH - 1) codeInputRefs.current[index + 1]?.focus();
  }

  function handleCodePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    distributeCode(0, event.clipboardData.getData("text"));
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
            <fieldset>
              <legend className="text-xs font-extrabold uppercase tracking-[0.1em] text-foreground">Código de seis dígitos</legend>
              <div className="mt-3 grid grid-cols-6 gap-2" onPaste={handleCodePaste}>
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { codeInputRefs.current[index] = element; }}
                    id={index === 0 ? "admin-code" : undefined}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`Dígito ${index + 1} do código`}
                    value={digit}
                    maxLength={index === 0 ? ADMIN_CODE_LENGTH : 1}
                    onChange={(event) => {
                      const numbers = event.target.value.replace(/\D/g, "");
                      if (numbers.length > 1) distributeCode(index, numbers);
                      else {
                        setCodeDigits((current) => current.map((item, itemIndex) => itemIndex === index ? numbers : item));
                        if (numbers && index < ADMIN_CODE_LENGTH - 1) codeInputRefs.current[index + 1]?.focus();
                      }
                    }}
                    onKeyDown={(event) => handleCodeKeyDown(index, event)}
                    className="aspect-square min-w-0 rounded-2xl border border-brand-border bg-white text-center text-xl font-extrabold text-foreground outline-none transition-all duration-200 focus:-translate-y-1 focus:border-brand focus:shadow-[0_10px_24px_rgb(233_30_99_/_16%)]"
                  />
                ))}
              </div>
            </fieldset>
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
