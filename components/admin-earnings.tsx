"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { FeedbackMessage, FormField } from "@/components/admin-product-form";
import { STORE_TIME_ZONE, formatStoreDateTime, storeDateTimeInputValue, storeInputToIso, storePeriodRange } from "@/lib/store-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Product = { id: string; name: string; price: number; stock: number };
type PaymentMethod = "credit_card" | "debit_card" | "pix" | "cash";
type Period = "today" | "7days" | "month" | "year";
type Sale = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: "paid" | "pending";
  sold_at: string;
  notes: string | null;
  voided_at: string | null;
};
type Feedback = { type: "success" | "error"; message: string } | null;

const paymentLabels: Record<PaymentMethod, string> = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
};

const periodLabels: Record<Period, string> = {
  today: "Hoje",
  "7days": "7 dias",
  month: "Este mês",
  year: "12 meses",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function periodRange(period: Period) {
  return storePeriodRange(period);
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminEarnings() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [soldAt, setSoldAt] = useState(storeDateTimeInputValue);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const [workingSaleId, setWorkingSaleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const range = periodRange(period);
    void Promise.all([
      supabase.from("products").select("id, name, price, stock").order("name"),
      supabase.functions.invoke("manage-sales", { body: { action: "list", ...range } }),
    ]).then(([productResult, saleResult]) => {
      if (cancelled) return;
      if (productResult.error) {
        setFeedback({ type: "error", message: "Não foi possível carregar os produtos." });
      } else {
        setProducts((productResult.data ?? []).map((item) => ({
          id: String(item.id), name: item.name, price: Number(item.price), stock: Number(item.stock),
        })));
      }
      if (saleResult.error) {
        void functionErrorMessage(saleResult.error, "Não foi possível carregar as vendas.").then((message) => setFeedback({ type: "error", message }));
      } else {
        const data = saleResult.data as { sales?: Sale[] } | null;
        setSales((data?.sales ?? []).map((sale) => ({
          ...sale,
          quantity: Number(sale.quantity),
          unit_price: Number(sale.unit_price),
          total_amount: Number(sale.total_amount),
        })));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [period, refreshKey, supabase]);

  const activeSales = sales.filter((sale) => !sale.voided_at);
  const received = activeSales.filter((sale) => sale.payment_status === "paid").reduce((sum, sale) => sum + sale.total_amount, 0);
  const pending = activeSales.filter((sale) => sale.payment_status === "pending").reduce((sum, sale) => sum + sale.total_amount, 0);
  const unitsSold = activeSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const chart = buildChart(activeSales, period);

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((item) => item.id === productId);
    setUnitPrice(product ? product.price.toFixed(2).replace(".", ",") : "");
  }

  async function registerSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    const quantity = Number(formData.get("quantity"));
    const price = Number(unitPrice.replace(/\./g, "").replace(",", "."));
    if (!selectedProductId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      setFeedback({ type: "error", message: "Informe produto, quantidade e valor válidos." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.functions.invoke("manage-sales", {
      body: {
        action: "create",
        product_id: selectedProductId,
        quantity,
        unit_price: price,
        payment_method: formData.get("payment_method"),
        payment_status: formData.get("payment_status"),
        sold_at: storeInputToIso(soldAt),
        notes: String(formData.get("notes") ?? "").trim(),
      },
    });
    if (error) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível registrar a venda.") });
    } else {
      setFeedback({ type: "success", message: "Venda registrada e estoque atualizado automaticamente." });
      setSelectedProductId("");
      setUnitPrice("");
      setSoldAt(storeDateTimeInputValue());
      form.reset();
      refresh();
    }
    setSaving(false);
  }

  async function settleSale(sale: Sale, method: PaymentMethod) {
    setWorkingSaleId(sale.id);
    setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-sales", { body: { action: "settle", sale_id: sale.id, payment_method: method } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível marcar o recebimento.") });
    else { setFeedback({ type: "success", message: "Pagamento marcado como recebido." }); refresh(); }
    setWorkingSaleId(null);
  }

  async function voidSale(sale: Sale) {
    if (confirmVoidId !== sale.id) {
      setConfirmVoidId(sale.id);
      return;
    }
    setWorkingSaleId(sale.id);
    setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-sales", { body: { action: "void", sale_id: sale.id } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível cancelar a venda.") });
    else { setFeedback({ type: "success", message: "Venda cancelada e unidades devolvidas ao estoque." }); refresh(); }
    setConfirmVoidId(null);
    setWorkingSaleId(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">RENDIMENTOS</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Fluxo de caixa</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Registre vendas, acompanhe valores recebidos e a receber e consulte o desempenho por período.</p>
      </div>

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.18em] text-brand">NOVA ENTRADA</p>
        <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Registrar venda</h2>
        <p className="mt-2 text-sm text-muted">A quantidade vendida será retirada do estoque ao salvar.</p>
        <form onSubmit={registerSale} className="mt-7 grid gap-5 sm:grid-cols-2">
          <FormField label="Produto vendido" htmlFor="sale-product">
            <select id="sale-product" required value={selectedProductId} onChange={(event) => selectProduct(event.target.value)} className="form-control">
              <option value="">Selecione um produto</option>
              {products.map((product) => <option key={product.id} value={product.id} disabled={product.stock === 0}>{product.name} — {product.stock} em estoque</option>)}
            </select>
          </FormField>
          <FormField label="Data e hora" htmlFor="sale-date"><input id="sale-date" type="datetime-local" required value={soldAt} onChange={(event) => setSoldAt(event.target.value)} className="form-control" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantidade" htmlFor="sale-quantity"><input id="sale-quantity" name="quantity" type="number" min={1} step={1} defaultValue={1} required className="form-control" /></FormField>
            <FormField label="Valor unitário" htmlFor="sale-price"><input id="sale-price" inputMode="decimal" required value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0,00" className="form-control" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Forma de pagamento" htmlFor="sale-method"><select id="sale-method" name="payment_method" defaultValue="pix" className="form-control">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
            <FormField label="Situação" htmlFor="sale-status"><select id="sale-status" name="payment_status" defaultValue="paid" className="form-control"><option value="paid">Recebido</option><option value="pending">A receber</option></select></FormField>
          </div>
          <div className="sm:col-span-2"><FormField label="Observação (opcional)" htmlFor="sale-notes"><textarea id="sale-notes" name="notes" rows={3} maxLength={500} className="form-control resize-y" placeholder="Ex.: encomenda retirada na loja" /></FormField></div>
          <div className="sm:col-span-2">
            {feedback && <FeedbackMessage feedback={feedback} />}
            <button type="submit" disabled={saving || products.length === 0} className="mt-5 min-h-14 rounded-full bg-brand px-7 text-sm font-extrabold text-white shadow-lg shadow-brand/20 disabled:opacity-60">{saving ? "REGISTRANDO..." : "REGISTRAR VENDA"}</button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-extrabold tracking-[0.18em] text-brand">RELATÓRIO</p><h2 className="mt-2 font-serif text-3xl sm:text-4xl">Visão financeira</h2></div>
          <div className="flex flex-wrap gap-2">{(Object.keys(periodLabels) as Period[]).map((item) => <button key={item} type="button" onClick={() => { setLoading(true); setPeriod(item); }} className={`rounded-full px-4 py-2 text-xs font-bold ${period === item ? "bg-brand text-white" : "border border-brand-border text-brand"}`}>{periodLabels[item]}</button>)}</div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Recebido" value={money(received)} />
          <SummaryCard label="A receber" value={money(pending)} />
          <SummaryCard label="Total vendido" value={money(received + pending)} />
          <SummaryCard label="Unidades" value={String(unitsSold)} />
        </div>

        <div className="mt-7 rounded-2xl border border-brand-border/70 bg-brand-soft/20 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold uppercase tracking-wider">Entradas no período</p><div className="flex gap-3 text-[0.65rem] text-muted"><span><i className="mr-1 inline-block size-2 rounded-full bg-brand" />Recebido</span><span><i className="mr-1 inline-block size-2 rounded-full bg-brand-border" />A receber</span></div></div>
          {chart.length === 0 ? <p className="py-16 text-center text-sm text-muted">Nenhuma venda neste período.</p> : <CashChart data={chart} />}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3"><h3 className="font-serif text-2xl">Movimentações</h3><span className="text-xs text-muted">{activeSales.length} registro(s)</span></div>
          {loading ? <p className="mt-5 text-sm text-muted">Carregando relatório...</p> : sales.length === 0 ? <p className="mt-5 text-sm text-muted">Nenhuma movimentação encontrada.</p> : (
            <div className="mt-4 space-y-3">{sales.map((sale) => <SaleRow key={sale.id} sale={sale} busy={workingSaleId === sale.id} confirmVoid={confirmVoidId === sale.id} onSettle={settleSale} onVoid={voidSale} />)}</div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-brand-border bg-white px-3 py-4 text-center shadow-sm"><strong className="block text-base font-extrabold text-brand sm:text-xl">{value}</strong><span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-wide text-muted">{label}</span></div>;
}

type ChartItem = { label: string; received: number; pending: number };

function buildChart(sales: Sale[], period: Period): ChartItem[] {
  const groups = new Map<string, ChartItem>();
  for (const sale of sales) {
    const date = new Date(sale.sold_at);
    const key = period === "today"
      ? `${new Intl.DateTimeFormat("pt-BR", { timeZone: STORE_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date)}h`
      : period === "year"
        ? date.toLocaleDateString("pt-BR", { timeZone: STORE_TIME_ZONE, month: "short", year: "2-digit" }).replace(" de ", "/")
        : date.toLocaleDateString("pt-BR", { timeZone: STORE_TIME_ZONE, day: "2-digit", month: "2-digit" });
    const item = groups.get(key) ?? { label: key, received: 0, pending: 0 };
    item[sale.payment_status === "paid" ? "received" : "pending"] += sale.total_amount;
    groups.set(key, item);
  }
  return [...groups.values()].reverse();
}

function CashChart({ data }: { data: ChartItem[] }) {
  const maximum = Math.max(...data.map((item) => item.received + item.pending), 1);
  return <div className="mt-6 flex h-52 items-end gap-2 overflow-x-auto pb-1">{data.map((item) => {
    const totalHeight = Math.max(((item.received + item.pending) / maximum) * 150, 8);
    const receivedHeight = item.received + item.pending === 0 ? 0 : (item.received / (item.received + item.pending)) * totalHeight;
    return <div key={item.label} className="flex min-w-10 flex-1 flex-col items-center justify-end" title={`${item.label}: ${money(item.received + item.pending)}`}><div className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-lg bg-brand-border" style={{ height: totalHeight }}><div className="w-full bg-brand" style={{ height: receivedHeight }} /></div><span className="mt-2 whitespace-nowrap text-[0.58rem] text-muted">{item.label}</span></div>;
  })}</div>;
}

function SaleRow({ sale, busy, confirmVoid, onSettle, onVoid }: { sale: Sale; busy: boolean; confirmVoid: boolean; onSettle: (sale: Sale, method: PaymentMethod) => void; onVoid: (sale: Sale) => void }) {
  const [method, setMethod] = useState<PaymentMethod>(sale.payment_method);
  const voided = Boolean(sale.voided_at);
  return <article className={`rounded-2xl border p-4 ${voided ? "border-slate-200 bg-slate-50 opacity-65" : "border-brand-border/80"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold">{sale.product_name}</p><p className="mt-1 text-xs text-muted">{formatStoreDateTime(sale.sold_at)} · {sale.quantity} × {money(sale.unit_price)}</p>{sale.notes && <p className="mt-2 text-xs text-muted">{sale.notes}</p>}</div><div className="text-right"><p className="font-extrabold text-brand">{money(sale.total_amount)}</p><p className={`mt-1 text-[0.65rem] font-extrabold uppercase ${voided ? "text-slate-500" : sale.payment_status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>{voided ? "Cancelada" : sale.payment_status === "paid" ? `Recebido · ${paymentLabels[sale.payment_method]}` : "A receber"}</p></div></div>
    {!voided && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-border/60 pt-3">{sale.payment_status === "pending" && <><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="min-h-10 rounded-full border border-brand-border bg-white px-3 text-xs">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" disabled={busy} onClick={() => onSettle(sale, method)} className="min-h-10 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-60">Marcar recebido</button></>}<button type="button" disabled={busy} onClick={() => onVoid(sale)} className="ml-auto min-h-10 rounded-full border border-red-200 px-4 text-xs font-bold text-red-600 disabled:opacity-60">{busy ? "Processando..." : confirmVoid ? "Confirmar cancelamento" : "Cancelar venda"}</button></div>}
  </article>;
}
