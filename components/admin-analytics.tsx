"use client";

import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatStoreDate, storeDateKey } from "@/lib/store-time";

type Period = "today" | "week" | "month";
type Range = { start: string; end: string };
type Summary = {
  visitors: number;
  sessions: number;
  whatsapp_clicks: number;
  checkout_visitors: number;
  conversion_rate: number;
  cart_items: number;
  cart_value: number;
};
type SeriesPoint = { date: string; visitors: number; sessions: number; whatsapp_clicks: number };

const emptySummary: Summary = {
  visitors: 0,
  sessions: 0,
  whatsapp_clicks: 0,
  checkout_visitors: 0,
  conversion_rate: 0,
  cart_items: 0,
  cart_value: 0,
};

const labels: Record<Period, string> = { today: "Hoje", week: "7 dias", month: "30 dias" };
const analyticsEnabled = process.env.NODE_ENV === "production";

function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function rangeFor(period: Period, anchor: string): Range {
  const days = period === "today" ? 0 : period === "week" ? 6 : 29;
  return { start: shiftDate(anchor, -days), end: anchor };
}

function number(value: unknown) {
  return Number(value) || 0;
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function errorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? "Não foi possível carregar as métricas.";
  }
  return "Não foi possível carregar as métricas.";
}

export function AdminAnalytics() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(storeDateKey);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [range, setRange] = useState<Range>(() => rangeFor("month", storeDateKey()));
  const [loading, setLoading] = useState(analyticsEnabled);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!analyticsEnabled) return;
    let cancelled = false;
    const requestedRange = rangeFor(period, anchor);
    void supabase.functions.invoke("manage-analytics", {
      body: { start: requestedRange.start, end: requestedRange.end },
    }).then(async ({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setFeedback(await errorMessage(error));
        setLoading(false);
        return;
      }
      const payload = data as { summary?: Record<string, unknown>; series?: Array<Record<string, unknown>>; range?: Range };
      const raw = payload.summary ?? {};
      setSummary({
        visitors: number(raw.visitors),
        sessions: number(raw.sessions),
        whatsapp_clicks: number(raw.whatsapp_clicks),
        checkout_visitors: number(raw.checkout_visitors),
        conversion_rate: number(raw.conversion_rate),
        cart_items: number(raw.cart_items),
        cart_value: number(raw.cart_value),
      });
      setSeries((payload.series ?? []).map((item) => ({
        date: String(item.date),
        visitors: number(item.visitors),
        sessions: number(item.sessions),
        whatsapp_clicks: number(item.whatsapp_clicks),
      })));
      setRange(payload.range ?? requestedRange);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [anchor, period, supabase]);

  return <div className="space-y-7">
    <header>
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">MÉTRICAS</p>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Caminho até o WhatsApp</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Acompanhe quantas pessoas visitaram a loja e quantas chegaram ao botão de finalizar o carrinho.</p>
    </header>

    <section className="rounded-[2rem] border border-brand-border bg-white p-4 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">{(Object.keys(labels) as Period[]).map((item) => <button key={item} type="button" onClick={() => { setLoading(analyticsEnabled); setFeedback(null); setPeriod(item); }} className={`rounded-full px-4 py-2 text-xs font-bold ${period === item ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>{labels[item]}</button>)}</div>
        <label className="flex items-center gap-2 text-xs font-bold text-muted">Até <input type="date" value={anchor} onChange={(event) => { setLoading(analyticsEnabled); setFeedback(null); setAnchor(event.target.value); }} className="rounded-xl border border-brand-border px-3 py-2 text-foreground" /></label>
      </div>
      <p className="mt-3 text-xs text-muted">Período: {formatStoreDate(`${range.start}T12:00:00-03:00`)} a {formatStoreDate(`${range.end}T12:00:00-03:00`)}</p>
    </section>

    {!analyticsEnabled && <p className="rounded-2xl border border-brand-border bg-brand-soft/50 p-4 text-sm text-brand">Prévia local: os cartões aparecem zerados e nenhuma visita de teste é contabilizada.</p>}
    {feedback && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{feedback}</p>}
    {loading ? <p className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-muted">Atualizando métricas...</p> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Visitantes" value={String(summary.visitors)} detail="Navegadores únicos" />
        <Metric label="Sessões" value={String(summary.sessions)} detail="Visitas de até 30 minutos" />
        <Metric label="Foram ao WhatsApp" value={String(summary.whatsapp_clicks)} detail={`${summary.checkout_visitors} visitantes únicos`} accent />
        <Metric label="Conversão" value={`${summary.conversion_rate.toFixed(1).replace(".", ",")}%`} detail="Sessões que chegaram ao WhatsApp" accent />
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <AnalyticsChart data={series} />
        <section className="h-full min-w-0 rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft">
          <p className="text-xs font-extrabold tracking-wider text-brand">CARRINHOS ENVIADOS</p>
          <p className="mt-3 font-serif text-4xl">{money(summary.cart_value)}</p>
          <p className="mt-2 text-sm text-muted">Valor potencial · {summary.cart_items} itens</p>
          <div className="mt-6 rounded-2xl bg-brand-soft/55 p-4 text-xs leading-5 text-muted">Esse valor representa os carrinhos levados ao WhatsApp. A confirmação da venda continua sendo registrada na aba Vendas.</div>
        </section>
      </div>
    </>}

    <section className="rounded-[2rem] border border-brand-border bg-white p-5 text-xs leading-6 text-muted shadow-soft">
      <strong className="text-foreground">Privacidade e precisão:</strong> não guardamos nome, telefone, e-mail, IP ou conteúdo do pedido. “Visitante” representa um navegador; trocar de aparelho ou limpar os dados do navegador pode gerar um novo visitante.
    </section>
  </div>;
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <article className={`rounded-[1.6rem] border p-4 shadow-sm ${accent ? "border-brand/20 bg-brand text-white" : "border-brand-border bg-white"}`}><p className={`text-[0.65rem] font-extrabold uppercase tracking-wider ${accent ? "text-white/75" : "text-muted"}`}>{label}</p><p className="mt-2 font-serif text-3xl">{value}</p><p className={`mt-1 text-[0.68rem] ${accent ? "text-white/75" : "text-muted"}`}>{detail}</p></article>;
}

function AnalyticsChart({ data }: { data: SeriesPoint[] }) {
  const maximum = Math.max(1, ...data.map((item) => Math.max(item.sessions, item.whatsapp_clicks)));
  return <section className="h-full min-w-0 rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold tracking-wider text-brand">FLUXO DIÁRIO</p><h2 className="mt-2 font-serif text-3xl">Visitas e WhatsApp</h2></div><div className="text-right text-[0.62rem] leading-5 text-muted"><span className="mr-3">● Sessões</span><span className="text-brand">● WhatsApp</span></div></div>
    <div className="mt-6 flex min-h-52 items-end gap-1.5 overflow-x-auto pb-2" aria-label="Gráfico diário de sessões e cliques no WhatsApp">
      {data.map((item) => <div key={item.date} className="flex min-w-8 flex-1 flex-col items-center gap-2"><div className="flex h-40 items-end gap-0.5"><span title={`${item.sessions} sessões`} className="w-2 rounded-t bg-brand-border" style={{ height: `${Math.max(3, item.sessions / maximum * 100)}%` }} /><span title={`${item.whatsapp_clicks} idas ao WhatsApp`} className="w-2 rounded-t bg-brand" style={{ height: `${Math.max(3, item.whatsapp_clicks / maximum * 100)}%` }} /></div><span className="text-[0.55rem] text-muted">{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span></div>)}
    </div>
  </section>;
}
