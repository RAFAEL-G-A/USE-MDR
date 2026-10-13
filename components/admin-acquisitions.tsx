"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { weightedAverageCost } from "@/lib/inventory-cost";

type Product = { id: string; name: string; price: number; stock: number; average_cost: number };
type Acquisition = {
  id: string; product_name: string; movement_type: "opening_balance" | "acquisition";
  quantity: number; unit_cost: number; previous_stock: number; new_stock: number;
  previous_average_cost: number; new_average_cost: number; supplier: string | null; acquired_at: string;
};
type Feedback = { type: "success" | "error"; message: string } | null;

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
function currencyNumber(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return normalized ? Number(normalized) : Number.NaN;
}
async function functionError(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminAcquisitions() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<Acquisition[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-inventory-acquisitions", { body: { action: "list" } });
    if (error) setFeedback({ type: "error", message: await functionError(error, "Não foi possível carregar as aquisições.") });
    else {
      setProducts((data?.products ?? []).map((item: Product) => ({ ...item, id: String(item.id), price: Number(item.price), stock: Number(item.stock), average_cost: Number(item.average_cost) })));
      setEntries((data?.acquisitions ?? []).map((item: Acquisition) => ({ ...item, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost), previous_stock: Number(item.previous_stock), new_stock: Number(item.new_stock), previous_average_cost: Number(item.previous_average_cost), new_average_cost: Number(item.new_average_cost) })));
    }
    setLoading(false);
  }
  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = products.find((product) => product.id === productId);
  const parsedQuantity = Number(quantity);
  const parsedCost = currencyNumber(unitCost);
  const previewAverage = selected && Number.isInteger(parsedQuantity) && parsedQuantity > 0 && Number.isFinite(parsedCost) && parsedCost >= 0
    ? weightedAverageCost(selected.stock, selected.average_cost, parsedQuantity, parsedCost)
    : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0 || !Number.isFinite(parsedCost) || parsedCost < 0) {
      setFeedback({ type: "error", message: "Informe produto, quantidade e custo válidos." }); return;
    }
    const form = new FormData(event.currentTarget);
    const nextPrice = salePrice.trim() ? currencyNumber(salePrice) : null;
    if (nextPrice !== null && (!Number.isFinite(nextPrice) || nextPrice <= 0)) {
      setFeedback({ type: "error", message: "Informe um novo preço válido ou deixe o campo vazio." }); return;
    }
    setSaving(true); setFeedback(null);
    const date = String(form.get("acquired_at") ?? "");
    const { error } = await supabase.functions.invoke("manage-inventory-acquisitions", { body: {
      action: "create", product_id: productId, quantity: parsedQuantity, unit_cost: parsedCost,
      sale_price: nextPrice, supplier: form.get("supplier"), document_reference: form.get("document_reference"),
      notes: form.get("notes"), acquired_at: date ? `${date}T12:00:00-03:00` : null,
    } });
    if (error) setFeedback({ type: "error", message: await functionError(error, "Não foi possível registrar a aquisição.") });
    else {
      setFeedback({ type: "success", message: "Aquisição registrada. Estoque e custo médio foram atualizados." });
      setQuantity(""); setUnitCost(""); setSalePrice(""); setProductId(""); event.currentTarget.reset();
      await refresh();
    }
    setSaving(false);
  }

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8">
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">ENTRADA DE MERCADORIA</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">Nova aquisição</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">O sistema soma a entrada ao estoque e recalcula o custo médio sem alterar vendas anteriores. O preço de venda só muda se você preencher o campo opcional.</p>
      <form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
        <Field label="Produto"><select required value={productId} onChange={(event) => setProductId(event.target.value)} className="form-control"><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>
        <Field label="Data da entrada"><input name="acquired_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="form-control" /></Field>
        <Field label="Quantidade"><input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="form-control" /></Field>
        <Field label="Custo por unidade"><input required inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="30,00" className="form-control" /></Field>
        <Field label="Fornecedor"><input name="supplier" maxLength={160} className="form-control" /></Field>
        <Field label="Nota ou documento"><input name="document_reference" maxLength={120} className="form-control" /></Field>
        <div className="sm:col-span-2"><Field label="Novo preço de venda (opcional)"><input inputMode="decimal" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder={selected ? `Atual: ${money(selected.price)}` : "O preço atual será mantido"} className="form-control" /></Field></div>
        <div className="sm:col-span-2"><Field label="Observação"><textarea name="notes" maxLength={500} rows={3} className="form-control resize-y" /></Field></div>
        {selected && <div className="rounded-2xl bg-brand-soft/45 p-4 text-sm sm:col-span-2"><p>Estoque atual: <strong>{selected.stock}</strong> · custo médio: <strong>{money(selected.average_cost)}</strong></p>{previewAverage !== null && <p className="mt-1">Depois da entrada: <strong>{selected.stock + parsedQuantity} unidades</strong> · novo custo médio: <strong>{money(previewAverage)}</strong></p>}</div>}
        {feedback && <FeedbackView feedback={feedback} />}
        <button disabled={saving || loading} className="min-h-12 rounded-full bg-brand px-6 text-sm font-extrabold text-white disabled:opacity-60 sm:col-span-2">{saving ? "REGISTRANDO..." : "REGISTRAR AQUISIÇÃO"}</button>
      </form>
    </section>
    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-8"><h2 className="font-serif text-3xl">Histórico de entradas</h2>{loading ? <p className="mt-5 text-sm text-muted">Carregando...</p> : entries.length === 0 ? <p className="mt-5 text-sm text-muted">Nenhuma entrada registrada.</p> : <div className="mt-5 space-y-3">{entries.map((entry) => <article key={entry.id} className="rounded-2xl border border-brand-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-extrabold">{entry.product_name}</p><p className="mt-1 text-xs text-muted">{entry.movement_type === "opening_balance" ? "Saldo inicial" : entry.supplier || "Aquisição"} · {new Date(entry.acquired_at).toLocaleDateString("pt-BR")}</p></div><p className="text-sm font-extrabold text-brand">+{entry.quantity} un.</p></div><p className="mt-3 text-xs text-muted">Entrada: {money(entry.unit_cost)} · custo médio: {money(entry.previous_average_cost)} → {money(entry.new_average_cost)} · estoque: {entry.previous_stock} → {entry.new_stock}</p></article>)}</div>}</section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-extrabold uppercase tracking-[0.1em]"><span className="mb-2 block">{label}</span>{children}</label>; }
function FeedbackView({ feedback }: { feedback: Exclude<Feedback, null> }) { return <p role={feedback.type === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm sm:col-span-2 ${feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.message}</p>; }
