"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { FeedbackMessage, FormField } from "@/components/admin-product-form";
import { formatStoreDate, formatStoreDateTime, formatStoreTime, storeDateKey, storeDateTimeInputValue, storeInputToIso } from "@/lib/store-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Period = "today" | "week" | "month";
type Section = "overview" | "sales" | "expenses" | "reports";
type PaymentMethod = "credit_card" | "debit_card" | "pix" | "cash";
type Feedback = { type: "success" | "error"; message: string } | null;

type Product = { id: string; name: string; price: number; stock: number };
type Sale = {
  id: string; order_id: string; product_name: string; quantity: number; unit_price: number; unit_cost: number;
  total_amount: number; total_cost: number; gross_profit: number; customer_name: string | null;
  payment_method: PaymentMethod; payment_status: "paid" | "pending"; sold_at: string;
  notes: string | null; voided_at: string | null;
};
type Expense = {
  id: string; description: string; amount: number; category: string; occurred_at: string;
  notes: string | null; status: "paid" | "pending";
};
type ProductRanking = { product_id: string; product_name: string; quantity: number; revenue?: number; profit?: number };
type Metrics = {
  gross_revenue: number; received_revenue: number; receivable_revenue: number; cost_of_goods: number;
  gross_profit: number; expenses: number; pending_expenses: number; net_profit: number;
  orders: number; average_ticket: number;
  payments: Record<string, { amount: number; sales: number }>;
  top_selling_products: ProductRanking[]; top_profitable_products: ProductRanking[];
};
type SeriesPoint = { date: string; revenue: number; cost: number; expenses: number; net_profit: number; orders: number };
type SaleCorrectionNotice = { order_id: string; sale_date: string; previous_total: number; corrected_total: number; difference: number; reason: string; corrected_at: string };
type Range = { start: string; end: string; previousStart: string; previousEnd: string };
type Settings = { recipient_email: string | null; daily_enabled: boolean; weekly_enabled: boolean; monthly_enabled: boolean; timezone: string };

const emptyMetrics: Metrics = {
  gross_revenue: 0, received_revenue: 0, receivable_revenue: 0, cost_of_goods: 0,
  gross_profit: 0, expenses: 0, pending_expenses: 0, net_profit: 0, orders: 0,
  average_ticket: 0, payments: {}, top_selling_products: [], top_profitable_products: [],
};

const periodLabels: Record<Period, string> = { today: "Hoje", week: "Semana", month: "Mês" };
const paymentLabels: Record<PaymentMethod, string> = { credit_card: "Crédito", debit_card: "Débito", pix: "Pix", cash: "Dinheiro" };
const expenseLabels: Record<string, string> = { suppliers: "Fornecedores", packaging: "Embalagens", shipping: "Entregas", marketing: "Marketing", utilities: "Contas", other: "Outros" };

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

function numericMetrics(value: unknown): Metrics {
  const raw = (value ?? {}) as Record<string, unknown>;
  const number = (key: string) => Number(raw[key] ?? 0);
  return {
    gross_revenue: number("gross_revenue"), received_revenue: number("received_revenue"),
    receivable_revenue: number("receivable_revenue"), cost_of_goods: number("cost_of_goods"),
    gross_profit: number("gross_profit"), expenses: number("expenses"), pending_expenses: number("pending_expenses"),
    net_profit: number("net_profit"), orders: number("orders"), average_ticket: number("average_ticket"),
    payments: (raw.payments ?? {}) as Metrics["payments"],
    top_selling_products: (raw.top_selling_products ?? []) as ProductRanking[],
    top_profitable_products: (raw.top_profitable_products ?? []) as ProductRanking[],
  };
}

export function AdminFinances() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [section, setSection] = useState<Section>("overview");
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(() => storeDateKey());
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [previous, setPrevious] = useState<Metrics>(emptyMetrics);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [saleCorrections, setSaleCorrections] = useState<SaleCorrectionNotice[]>([]);
  const [range, setRange] = useState<Range | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [soldAt, setSoldAt] = useState(storeDateTimeInputValue);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      supabase.functions.invoke("manage-finances", { body: { action: "dashboard", period, anchor } }),
      supabase.functions.invoke("manage-product", { body: { action: "list" } }),
      supabase.functions.invoke("manage-finances", { body: { action: "get_settings" } }),
    ]).then(async ([dashboardResult, productResult, settingsResult]) => {
      if (cancelled) return;
      if (dashboardResult.error) {
        setFeedback({ type: "error", message: await functionErrorMessage(dashboardResult.error, "Não foi possível carregar as finanças.") });
        setLoading(false);
        return;
      }
      const dashboard = dashboardResult.data as { metrics?: unknown; previous_metrics?: unknown; series?: SeriesPoint[]; expenses?: Expense[]; sale_corrections?: SaleCorrectionNotice[]; range?: Range };
      const nextRange = dashboard.range ?? null;
      setMetrics(numericMetrics(dashboard.metrics));
      setPrevious(numericMetrics(dashboard.previous_metrics));
      setSeries((dashboard.series ?? []).map((item) => ({ ...item, revenue: Number(item.revenue), cost: Number(item.cost), expenses: Number(item.expenses), net_profit: Number(item.net_profit), orders: Number(item.orders) })));
      setExpenses((dashboard.expenses ?? []).map((item) => ({ ...item, amount: Number(item.amount) })));
      setSaleCorrections((dashboard.sale_corrections ?? []).map((item) => ({ ...item, previous_total: Number(item.previous_total), corrected_total: Number(item.corrected_total), difference: Number(item.difference) })));
      setRange(nextRange);
      const productPayload = productResult.data as { products?: Array<Record<string, unknown>> } | null;
      setProducts((productPayload?.products ?? []).map((item) => ({ id: String(item.id), name: String(item.name), price: Number(item.price), stock: Number(item.stock) })));
      const settingsPayload = settingsResult.data as { settings?: Settings } | null;
      if (settingsPayload?.settings) setSettings(settingsPayload.settings);
      if (nextRange) {
        const saleResult = await supabase.functions.invoke("manage-sales", { body: { action: "list", from: `${nextRange.start}T00:00:00-03:00`, to: `${nextDate(nextRange.end)}T00:00:00-03:00` } });
        if (!cancelled && !saleResult.error) {
          const payload = saleResult.data as { sales?: Sale[] } | null;
          setSales((payload?.sales ?? []).map((sale) => ({ ...sale, quantity: Number(sale.quantity), unit_price: Number(sale.unit_price), unit_cost: Number(sale.unit_cost), total_amount: Number(sale.total_amount), total_cost: Number(sale.total_cost), gross_profit: Number(sale.gross_profit) })));
        }
      }
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [anchor, period, refreshKey, supabase]);

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((item) => item.id === productId);
    setUnitPrice(product ? product.price.toFixed(2).replace(".", ",") : "");
  }

  async function registerSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-sales", { body: {
      action: "create", product_id: selectedProductId, quantity: Number(data.get("quantity")),
      unit_price: Number(unitPrice.replace(/\./g, "").replace(",", ".")), customer_name: String(data.get("customer_name") ?? "").trim(),
      payment_method: data.get("payment_method"), payment_status: data.get("payment_status"),
      sold_at: storeInputToIso(soldAt), notes: String(data.get("notes") ?? "").trim(),
    } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível registrar a venda.") });
    else { setFeedback({ type: "success", message: "Venda registrada e estoque atualizado." }); form.reset(); setSelectedProductId(""); setUnitPrice(""); setSoldAt(storeDateTimeInputValue()); refresh(); }
    setSaving(false);
  }

  async function saleAction(action: "settle" | "void", sale: Sale, method?: PaymentMethod) {
    setWorkingId(sale.id); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-sales", { body: { action: action === "settle" ? "settle_order" : "void_order", order_id: sale.order_id, payment_method: method ?? sale.payment_method } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível atualizar a venda.") });
    else { setFeedback({ type: "success", message: action === "settle" ? "Pagamento recebido." : "Venda cancelada e estoque devolvido." }); refresh(); }
    setWorkingId(null);
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-finances", { body: {
      action: editingExpense ? "update_expense" : "create_expense", id: editingExpense?.id,
      description: String(data.get("description") ?? "").trim(), amount: Number(String(data.get("amount") ?? "").replace(/\./g, "").replace(",", ".")),
      category: data.get("category"), status: data.get("status"), occurred_at: storeInputToIso(String(data.get("occurred_at"))),
      notes: String(data.get("notes") ?? "").trim(),
    } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível salvar a despesa.") });
    else { setFeedback({ type: "success", message: editingExpense ? "Despesa atualizada." : "Despesa registrada." }); form.reset(); setEditingExpense(null); refresh(); }
    setSaving(false);
  }

  async function voidExpense(expense: Expense) {
    setWorkingId(expense.id); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-finances", { body: { action: "void_expense", id: expense.id } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível excluir a despesa.") });
    else { setFeedback({ type: "success", message: "Despesa removida do fluxo de caixa." }); refresh(); }
    setWorkingId(null);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-finances", { body: {
      action: "update_settings", recipient_email: String(data.get("recipient_email") ?? "").trim(),
      daily_enabled: data.get("daily_enabled") === "on", weekly_enabled: data.get("weekly_enabled") === "on", monthly_enabled: data.get("monthly_enabled") === "on",
    } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível salvar os relatórios.") });
    else { setFeedback({ type: "success", message: "Preferências de relatório salvas." }); refresh(); }
    setSaving(false);
  }

  async function createClosure() {
    if (!range) return;
    setSaving(true); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-finances", { body: { action: "create_closure", period_type: period === "today" ? "daily" : period === "week" ? "weekly" : "monthly", period_start: range.start, period_end: range.end } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível gerar o fechamento.") });
    else setFeedback({ type: "success", message: "Fechamento gerado com sucesso. A operação é segura contra duplicidade." });
    setSaving(false);
  }

  return <div className="space-y-7">
    <header>
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">FINANÇAS</p>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Visão da loja</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Vendas, custos, despesas e lucro em um painel protegido e adaptado ao celular.</p>
    </header>

    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Seções financeiras">
      {(["overview", "sales", "expenses", "reports"] as Section[]).map((item) => <button key={item} type="button" onClick={() => setSection(item)} className={`min-h-11 shrink-0 rounded-full px-5 text-xs font-extrabold ${section === item ? "bg-brand text-white" : "border border-brand-border bg-white text-brand"}`}>{({ overview: "Resumo", sales: "Vendas", expenses: "Despesas", reports: "Relatórios" } as Record<Section, string>)[item]}</button>)}
    </div>

    <section className="rounded-[2rem] border border-brand-border bg-white p-4 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">{(Object.keys(periodLabels) as Period[]).map((item) => <button key={item} type="button" onClick={() => { setLoading(true); setFeedback(null); setPeriod(item); }} className={`rounded-full px-4 py-2 text-xs font-bold ${period === item ? "bg-brand-soft text-brand" : "text-muted"}`}>{periodLabels[item]}</button>)}</div>
        <label className="flex items-center gap-2 text-xs font-bold text-muted">Referência <input type="date" value={anchor} onChange={(event) => { setLoading(true); setFeedback(null); setAnchor(event.target.value); }} className="rounded-xl border border-brand-border px-3 py-2 text-foreground" /></label>
      </div>
      {range && <p className="mt-3 text-xs text-muted">Período comercial: {formatStoreDate(`${range.start}T12:00:00-03:00`)} a {formatStoreDate(`${range.end}T12:00:00-03:00`)} · horário de Pernambuco</p>}
    </section>

    {feedback && <FeedbackMessage feedback={feedback} />}
    {loading && <p className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-muted">Atualizando dados financeiros...</p>}

    {!loading && section === "overview" && <Overview metrics={metrics} previous={previous} series={series} corrections={saleCorrections} />}
    {section === "sales" && <SalesPanel products={products} sales={sales} selectedProductId={selectedProductId} unitPrice={unitPrice} soldAt={soldAt} saving={saving} workingId={workingId} onSelectProduct={selectProduct} onUnitPrice={setUnitPrice} onSoldAt={setSoldAt} onSubmit={registerSale} onAction={saleAction} />}
    {section === "expenses" && <ExpensesPanel expenses={expenses} editing={editingExpense} saving={saving} workingId={workingId} onEdit={setEditingExpense} onSubmit={saveExpense} onVoid={voidExpense} />}
    {section === "reports" && <ReportsPanel settings={settings} period={period} range={range} saving={saving} onSubmit={saveSettings} onClosure={createClosure} />}
  </div>;
}

function Overview({ metrics, previous, series, corrections }: { metrics: Metrics; previous: Metrics; series: SeriesPoint[]; corrections: SaleCorrectionNotice[] }) {
  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Faturamento" value={money(metrics.gross_revenue)} change={change(metrics.gross_revenue, previous.gross_revenue)} />
      <MetricCard label="Lucro líquido" value={money(metrics.net_profit)} change={change(metrics.net_profit, previous.net_profit)} accent />
      <MetricCard label="A receber" value={money(metrics.receivable_revenue)} />
      <MetricCard label="Ticket médio" value={money(metrics.average_ticket)} change={change(metrics.average_ticket, previous.average_ticket)} />
      <MetricCard label="Custo dos produtos" value={money(metrics.cost_of_goods)} />
      <MetricCard label="Despesas pagas" value={money(metrics.expenses)} />
      <MetricCard label="Despesas pendentes" value={money(metrics.pending_expenses)} />
      <MetricCard label="Vendas" value={String(metrics.orders)} change={change(metrics.orders, previous.orders)} />
    </div>
    {corrections.length > 0 && <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-extrabold tracking-wider text-amber-800">CORREÇÕES REGISTRADAS NESTE FECHAMENTO</p><div className="mt-3 space-y-3">{corrections.map((correction) => <div key={`${correction.order_id}-${correction.corrected_at}`} className="rounded-2xl bg-white/75 p-4 text-sm"><p>Venda de <strong>{formatStoreDate(`${correction.sale_date}T12:00:00-03:00`)}</strong>: <strong>{money(correction.previous_total)}</strong> corrigida para <strong>{money(correction.corrected_total)}</strong>.</p><p className="mt-1 text-xs text-muted">Corrigida às {formatStoreTime(correction.corrected_at)} · {correction.reason}</p></div>)}</div></section>}
    <FinancialChart data={series} />
    <div className="grid gap-5 lg:grid-cols-2"><PaymentBreakdown metrics={metrics} /><ProductRankingCard title="Mais vendidos" products={metrics.top_selling_products} valueKey="revenue" /></div>
    <ProductRankingCard title="Mais lucrativos" products={metrics.top_profitable_products} valueKey="profit" />
  </div>;
}

function change(current: number, prior: number) {
  if (!prior) return current ? 100 : 0;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function MetricCard({ label, value, change: percent, accent = false }: { label: string; value: string; change?: number; accent?: boolean }) {
  return <article className={`rounded-2xl border p-4 shadow-sm ${accent ? "border-brand bg-brand text-white" : "border-brand-border bg-white"}`}><p className={`text-[0.64rem] font-extrabold uppercase tracking-wide ${accent ? "text-white/75" : "text-muted"}`}>{label}</p><strong className="mt-2 block text-lg sm:text-xl">{value}</strong>{percent !== undefined && <span className={`mt-2 block text-[0.65rem] font-bold ${accent ? "text-white/80" : percent >= 0 ? "text-emerald-700" : "text-red-600"}`}>{percent >= 0 ? "↑" : "↓"} {Math.abs(percent).toFixed(1).replace(".", ",")}% vs. período anterior</span>}</article>;
}

function FinancialChart({ data }: { data: SeriesPoint[] }) {
  const maximum = Math.max(...data.map((item) => Math.max(item.revenue, item.expenses, Math.abs(item.net_profit))), 1);
  return <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold tracking-wider text-brand">EVOLUÇÃO</p><h2 className="mt-1 font-serif text-2xl">Entradas e resultado</h2></div><div className="text-[0.62rem] text-muted"><span className="mr-3">● Receita</span><span className="mr-3 text-amber-600">● Despesa</span><span className="text-emerald-600">● Lucro</span></div></div><div className="mt-6 flex h-56 items-end gap-2 overflow-x-auto border-b border-brand-border/70 pb-1">{data.map((item) => <div key={item.date} className="flex min-w-12 flex-1 flex-col items-center justify-end"><div className="flex h-44 items-end gap-1"><span title={`Receita ${money(item.revenue)}`} className="w-2 rounded-t bg-brand" style={{ height: `${Math.max(item.revenue / maximum * 100, item.revenue ? 4 : 0)}%` }} /><span title={`Despesas ${money(item.expenses)}`} className="w-2 rounded-t bg-amber-400" style={{ height: `${Math.max(item.expenses / maximum * 100, item.expenses ? 4 : 0)}%` }} /><span title={`Lucro ${money(item.net_profit)}`} className={`w-2 rounded-t ${item.net_profit >= 0 ? "bg-emerald-500" : "bg-red-400"}`} style={{ height: `${Math.max(Math.abs(item.net_profit) / maximum * 100, item.net_profit ? 4 : 0)}%` }} /></div><span className="mt-2 text-[0.58rem] text-muted">{formatStoreDate(`${item.date}T12:00:00-03:00`).slice(0, 5)}</span></div>)}</div></section>;
}

function PaymentBreakdown({ metrics }: { metrics: Metrics }) {
  const entries = Object.entries(metrics.payments);
  const maximum = Math.max(...entries.map(([, item]) => Number(item.amount)), 1);
  const labels: Record<string, string> = { card: "Cartões", pix: "Pix", cash: "Dinheiro" };
  return <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><h2 className="font-serif text-2xl">Recebimentos</h2>{entries.length === 0 ? <p className="mt-5 text-sm text-muted">Nenhum recebimento no período.</p> : <div className="mt-5 space-y-4">{entries.map(([key, item]) => <div key={key}><div className="flex justify-between text-xs"><strong>{labels[key] ?? key}</strong><span>{money(Number(item.amount))} · {item.sales} venda(s)</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${Number(item.amount) / maximum * 100}%` }} /></div></div>)}</div>}</section>;
}

function ProductRankingCard({ title, products, valueKey }: { title: string; products: ProductRanking[]; valueKey: "revenue" | "profit" }) {
  return <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><h2 className="font-serif text-2xl">{title}</h2>{products.length === 0 ? <p className="mt-5 text-sm text-muted">Ainda não há dados suficientes.</p> : <ol className="mt-4 divide-y divide-brand-border/60">{products.map((product, index) => <li key={product.product_id} className="flex items-center gap-3 py-3"><span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product.product_name}</p><p className="text-xs text-muted">{product.quantity} unidade(s)</p></div><strong className="text-sm text-brand">{money(Number(product[valueKey] ?? 0))}</strong></li>)}</ol>}</section>;
}

function SalesPanel(props: { products: Product[]; sales: Sale[]; selectedProductId: string; unitPrice: string; soldAt: string; saving: boolean; workingId: string | null; onSelectProduct: (id: string) => void; onUnitPrice: (value: string) => void; onSoldAt: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onAction: (action: "settle" | "void", sale: Sale, method?: PaymentMethod) => void }) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><h2 className="font-serif text-3xl">Registrar venda</h2><p className="mt-2 text-sm text-muted">O estoque e o custo são registrados automaticamente.</p><form onSubmit={props.onSubmit} className="mt-6 space-y-4"><FormField label="Produto" htmlFor="finance-sale-product"><select id="finance-sale-product" required value={props.selectedProductId} onChange={(event) => props.onSelectProduct(event.target.value)} className="form-control"><option value="">Selecione</option>{props.products.map((product) => <option key={product.id} value={product.id} disabled={!product.stock}>{product.name} — {product.stock} un.</option>)}</select></FormField><FormField label="Cliente (opcional)" htmlFor="finance-customer"><input id="finance-customer" name="customer_name" maxLength={160} className="form-control" /></FormField><div className="grid grid-cols-2 gap-3"><FormField label="Quantidade" htmlFor="finance-quantity"><input id="finance-quantity" name="quantity" type="number" min={1} defaultValue={1} required className="form-control" /></FormField><FormField label="Valor unitário" htmlFor="finance-unit-price"><input id="finance-unit-price" required inputMode="decimal" value={props.unitPrice} onChange={(event) => props.onUnitPrice(event.target.value)} className="form-control" /></FormField></div><FormField label="Data e hora" htmlFor="finance-sold-at"><input id="finance-sold-at" type="datetime-local" required value={props.soldAt} onChange={(event) => props.onSoldAt(event.target.value)} className="form-control" /></FormField><div className="grid grid-cols-2 gap-3"><FormField label="Pagamento" htmlFor="finance-payment"><select id="finance-payment" name="payment_method" defaultValue="pix" className="form-control">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField><FormField label="Situação" htmlFor="finance-payment-status"><select id="finance-payment-status" name="payment_status" defaultValue="paid" className="form-control"><option value="paid">Recebido</option><option value="pending">A receber</option></select></FormField></div><FormField label="Observação" htmlFor="finance-sale-notes"><textarea id="finance-sale-notes" name="notes" rows={2} maxLength={500} className="form-control resize-y" /></FormField><button disabled={props.saving || !props.selectedProductId} className="min-h-13 w-full rounded-full bg-brand text-xs font-extrabold text-white disabled:opacity-60">{props.saving ? "SALVANDO..." : "REGISTRAR VENDA"}</button></form></section><section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><div className="flex justify-between gap-3"><h2 className="font-serif text-3xl">Movimentações</h2><span className="text-xs text-muted">{props.sales.length}</span></div><div className="mt-5 space-y-3">{props.sales.length === 0 ? <p className="text-sm text-muted">Nenhuma venda no período.</p> : props.sales.map((sale) => <SaleItem key={sale.id} sale={sale} busy={props.workingId === sale.id} onAction={props.onAction} />)}</div></section></div>;
}

function SaleItem({ sale, busy, onAction }: { sale: Sale; busy: boolean; onAction: (action: "settle" | "void", sale: Sale, method?: PaymentMethod) => void }) {
  const [method, setMethod] = useState<PaymentMethod>(sale.payment_method);
  return <article className={`rounded-2xl border p-4 ${sale.voided_at ? "border-slate-200 bg-slate-50 opacity-60" : "border-brand-border"}`}><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold">{sale.product_name}</p><p className="mt-1 text-xs text-muted">{sale.customer_name || "Cliente não informado"} · {sale.quantity} un.</p><p className="mt-1 text-[0.65rem] text-muted">{formatStoreDateTime(sale.sold_at)}</p></div><div className="text-right"><strong className="text-brand">{money(sale.total_amount)}</strong><p className="mt-1 text-[0.62rem] text-muted">Lucro bruto {money(sale.gross_profit)}</p></div></div>{!sale.voided_at && <div className="mt-3 flex flex-wrap gap-2 border-t border-brand-border/60 pt-3">{sale.payment_status === "pending" && <><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="min-h-9 rounded-full border border-brand-border px-3 text-xs">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" disabled={busy} onClick={() => onAction("settle", sale, method)} className="rounded-full bg-emerald-600 px-4 text-xs font-bold text-white">Receber</button></>}<button type="button" disabled={busy} onClick={() => onAction("void", sale)} className="ml-auto rounded-full border border-red-200 px-4 text-xs font-bold text-red-600">Cancelar</button></div>}</article>;
}

function ExpensesPanel({ expenses, editing, saving, workingId, onEdit, onSubmit, onVoid }: { expenses: Expense[]; editing: Expense | null; saving: boolean; workingId: string | null; onEdit: (expense: Expense | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onVoid: (expense: Expense) => void }) {
  return <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><h2 className="font-serif text-3xl">{editing ? "Editar despesa" : "Nova despesa"}</h2><form key={editing?.id ?? "new"} onSubmit={onSubmit} className="mt-6 space-y-4"><FormField label="Descrição" htmlFor="expense-description"><input id="expense-description" name="description" required maxLength={160} defaultValue={editing?.description} className="form-control" /></FormField><div className="grid grid-cols-2 gap-3"><FormField label="Valor" htmlFor="expense-amount"><input id="expense-amount" name="amount" required inputMode="decimal" defaultValue={editing?.amount.toFixed(2).replace(".", ",")} className="form-control" /></FormField><FormField label="Categoria" htmlFor="expense-category"><select id="expense-category" name="category" defaultValue={editing?.category ?? "suppliers"} className="form-control">{Object.entries(expenseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField></div><div className="grid grid-cols-2 gap-3"><FormField label="Data e hora" htmlFor="expense-date"><input id="expense-date" name="occurred_at" type="datetime-local" required defaultValue={editing ? storeDateTimeInputValue(editing.occurred_at) : storeDateTimeInputValue()} className="form-control" /></FormField><FormField label="Situação" htmlFor="expense-status"><select id="expense-status" name="status" defaultValue={editing?.status ?? "paid"} className="form-control"><option value="paid">Paga</option><option value="pending">Pendente</option></select></FormField></div><FormField label="Observação" htmlFor="expense-notes"><textarea id="expense-notes" name="notes" rows={3} maxLength={500} defaultValue={editing?.notes ?? ""} className="form-control resize-y" /></FormField><div className="flex gap-3"><button disabled={saving} className="min-h-12 rounded-full bg-brand px-6 text-xs font-extrabold text-white">{saving ? "SALVANDO..." : editing ? "SALVAR ALTERAÇÃO" : "ADICIONAR DESPESA"}</button>{editing && <button type="button" onClick={() => onEdit(null)} className="rounded-full border border-brand-border px-5 text-xs font-bold text-brand">Cancelar</button>}</div></form></section><section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><h2 className="font-serif text-3xl">Despesas recentes</h2><div className="mt-5 space-y-3">{expenses.length === 0 ? <p className="text-sm text-muted">Nenhuma despesa registrada.</p> : expenses.map((expense) => <article key={expense.id} className="rounded-2xl border border-brand-border p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-extrabold">{expense.description}</p><p className="mt-1 text-xs text-muted">{expenseLabels[expense.category]} · {formatStoreDate(expense.occurred_at)} · {expense.status === "paid" ? "Paga" : "Pendente"}</p></div><strong className="text-brand">{money(expense.amount)}</strong></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => onEdit(expense)} className="rounded-full border border-brand-border px-4 py-2 text-xs font-bold text-brand">Editar</button><button type="button" disabled={workingId === expense.id} onClick={() => onVoid(expense)} className="rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-600">Excluir</button></div></article>)}</div></section></div>;
}

function ReportsPanel({ settings, period, range, saving, onSubmit, onClosure }: { settings: Settings | null; period: Period; range: Range | null; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClosure: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><p className="text-xs font-extrabold tracking-wider text-brand">E-MAIL AUTOMÁTICO</p><h2 className="mt-2 font-serif text-3xl">Relatórios</h2><p className="mt-2 text-sm leading-6 text-muted">O endereço fica protegido no banco e nunca aparece no catálogo nem no GitHub.</p>{settings && <form onSubmit={onSubmit} className="mt-6 space-y-4"><FormField label="E-mail destinatário" htmlFor="report-email"><input id="report-email" name="recipient_email" type="email" required defaultValue={settings.recipient_email ?? ""} className="form-control" /></FormField>{(["daily_enabled", "weekly_enabled", "monthly_enabled"] as const).map((name) => <label key={name} className="flex items-center justify-between rounded-2xl border border-brand-border px-4 py-3 text-sm font-bold"><span>{name === "daily_enabled" ? "Relatório diário" : name === "weekly_enabled" ? "Relatório semanal" : "Relatório mensal"}</span><input name={name} type="checkbox" defaultChecked={settings[name]} className="size-5 accent-brand" /></label>)}<button disabled={saving} className="min-h-12 rounded-full bg-brand px-6 text-xs font-extrabold text-white">SALVAR PREFERÊNCIAS</button></form>}</section><section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft"><p className="text-xs font-extrabold tracking-wider text-brand">FECHAMENTO MANUAL</p><h2 className="mt-2 font-serif text-3xl">Consolidar período</h2><p className="mt-3 text-sm leading-6 text-muted">Gera um retrato permanente do {periodLabels[period].toLowerCase()} selecionado. Repetir o mesmo período não cria duplicidade.</p>{range && <div className="mt-5 rounded-2xl bg-brand-soft/50 p-4 text-sm"><strong>{formatStoreDate(`${range.start}T12:00:00-03:00`)}</strong> até <strong>{formatStoreDate(`${range.end}T12:00:00-03:00`)}</strong></div>}<button type="button" onClick={onClosure} disabled={saving || !range} className="mt-5 min-h-12 rounded-full border border-brand px-6 text-xs font-extrabold text-brand disabled:opacity-60">GERAR FECHAMENTO</button><div className="mt-7 rounded-2xl border border-brand-border p-4"><p className="text-xs font-extrabold text-brand">REGRA DA LOJA</p><p className="mt-2 text-xs leading-5 text-muted">Segunda a sexta: 17h. Sábado: 13h. Vendas após o horário entram no próximo dia comercial. Domingo é consolidado na segunda-feira.</p></div></section></div>;
}
