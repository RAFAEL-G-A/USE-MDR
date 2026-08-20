"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { FeedbackMessage, FormField } from "@/components/admin-product-form";
import { filterProductsByName, groupSaleRows, parseBrazilianCurrency, saleCartTotal, upsertSaleCartItem, validateDiscountedTotal, type SaleCartItem, type SaleCorrection, type SaleRow } from "@/lib/admin-sales";
import { formatStoreDateTime, storeDateKey, storeDateKeyDaysAgo, storeDateTimeInputValue, storeInputToIso } from "@/lib/store-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Product = { id: string; name: string; price: number; stock: number };
type PaymentMethod = SaleRow["payment_method"];
type Mode = "single" | "group";
type Period = "today" | "7days" | "30days" | "all";
type Feedback = { type: "success" | "error"; message: string } | null;
type CorrectionDraft = {
  items: Array<{ sale_id: string; product_id: string; quantity: number; unit_price: number }>;
  customer_name: string;
  payment_method: PaymentMethod;
  payment_status: "paid" | "pending";
  sold_at: string;
  notes: string;
  reason: string;
  final_total: number | null;
};

const paymentLabels: Record<PaymentMethod, string> = {
  credit_card: "Cartão de crédito", debit_card: "Cartão de débito", pix: "Pix", cash: "Dinheiro",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  return fallback;
}

export function AdminSales() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<Mode>("single");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [corrections, setCorrections] = useState<SaleCorrection[]>([]);
  const [cart, setCart] = useState<SaleCartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [discountedTotal, setDiscountedTotal] = useState("");
  const [soldAt, setSoldAt] = useState(storeDateTimeInputValue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("paid");
  const [period, setPeriod] = useState<Period>("30days");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [productResult, saleResult] = await Promise.all([
      supabase.functions.invoke("manage-product", { body: { action: "list" } }),
      supabase.functions.invoke("manage-sales", { body: { action: "list" } }),
    ]);
    if (productResult.error) setFeedback({ type: "error", message: await functionErrorMessage(productResult.error, "Não foi possível carregar os produtos.") });
    else {
      const payload = productResult.data as { products?: Array<Record<string, unknown>> } | null;
      setProducts((payload?.products ?? []).map((item) => ({ id: String(item.id), name: String(item.name), price: Number(item.price), stock: Number(item.stock) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    }
    if (saleResult.error) setFeedback({ type: "error", message: await functionErrorMessage(saleResult.error, "Não foi possível carregar o histórico de vendas.") });
    else {
      const payload = saleResult.data as { sales?: SaleRow[]; corrections?: SaleCorrection[] } | null;
      setSales((payload?.sales ?? []).map((sale) => ({ ...sale, quantity: Number(sale.quantity), unit_price: Number(sale.unit_price), total_amount: Number(sale.total_amount) })));
      setCorrections((payload?.corrections ?? []).map((correction) => ({ ...correction, previous_total: Number(correction.previous_total), corrected_total: Number(correction.corrected_total) })));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load, refreshKey]);

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const filteredProducts = useMemo(() => filterProductsByName(products, productSearch), [products, productSearch]);
  const orders = useMemo(() => groupSaleRows(sales), [sales]);
  const correctionsByOrder = useMemo(() => {
    const grouped = new Map<string, SaleCorrection[]>();
    for (const correction of corrections) grouped.set(correction.order_id, [...(grouped.get(correction.order_id) ?? []), correction]);
    return grouped;
  }, [corrections]);
  const filteredOrders = useMemo(() => {
    if (period === "all") return orders;
    const days = period === "today" ? 1 : period === "7days" ? 7 : 30;
    const startKey = storeDateKeyDaysAgo(days - 1);
    return orders.filter((order) => storeDateKey(order.sold_at) >= startKey);
  }, [orders, period]);
  const activeOrders = filteredOrders.filter((order) => !order.voided);
  const periodTotal = activeOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingTotal = activeOrders.filter((order) => order.payment_status === "pending").reduce((sum, order) => sum + order.total, 0);

  function selectProduct(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((item) => item.id === productId);
    setUnitPrice(product ? product.price.toFixed(2).replace(".", ",") : "");
    setQuantity(1);
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setCart([]);
    setProductSearch("");
    setSelectedProductId("");
    setUnitPrice("");
    setDiscountedTotal("");
    setQuantity(1);
    setFeedback(null);
  }

  function currentItem(): SaleCartItem | null {
    const price = parseBrazilianCurrency(unitPrice);
    if (!selectedProduct || !Number.isInteger(quantity) || quantity < 1 || quantity > selectedProduct.stock || !Number.isFinite(price) || price <= 0) return null;
    return { product_id: selectedProduct.id, product_name: selectedProduct.name, quantity, unit_price: price, stock: selectedProduct.stock };
  }

  const currentSaleItem = currentItem();
  const originalSaleTotal = mode === "single"
    ? (currentSaleItem ? currentSaleItem.quantity * currentSaleItem.unit_price : 0)
    : saleCartTotal(cart);
  const discountValidation = validateDiscountedTotal(originalSaleTotal, discountedTotal);
  const effectiveSaleTotal = discountValidation.value ?? originalSaleTotal;

  function addToGroup() {
    const item = currentItem();
    if (!item) {
      setFeedback({ type: "error", message: "Selecione um produto disponível e informe quantidade e valor válidos." });
      return;
    }
    try {
      setCart((items) => upsertSaleCartItem(items, item));
      setFeedback(null);
      setProductSearch(""); setSelectedProductId(""); setUnitPrice(""); setQuantity(1);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível adicionar o produto." });
    }
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const items = mode === "single" ? [currentItem()].filter(Boolean) as SaleCartItem[] : cart;
    if (items.length === 0) {
      setFeedback({ type: "error", message: mode === "single" ? "Selecione o produto vendido." : "Adicione ao menos um produto à venda em grupo." });
      return;
    }
    const validatedDiscount = validateDiscountedTotal(saleCartTotal(items), discountedTotal);
    if (validatedDiscount.error) {
      setFeedback({ type: "error", message: validatedDiscount.error });
      return;
    }
    setSaving(true); setFeedback(null);
    const body = {
      action: mode === "single" ? "create" : "create_batch",
      ...(mode === "single" ? items[0] : { items: items.map(({ product_id, quantity: itemQuantity, unit_price }) => ({ product_id, quantity: itemQuantity, unit_price })) }),
      final_total: validatedDiscount.value,
      customer_name: String(form.get("customer_name") ?? "").trim(), payment_method: paymentMethod,
      payment_status: paymentStatus, sold_at: storeInputToIso(soldAt), notes: String(form.get("notes") ?? "").trim(),
    };
    const { error } = await supabase.functions.invoke("manage-sales", { body });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível registrar a venda.") });
    else {
      setFeedback({ type: "success", message: `${mode === "single" ? "Venda" : "Venda em grupo"} registrada. O estoque foi atualizado automaticamente.` });
      setCart([]); setProductSearch(""); setSelectedProductId(""); setUnitPrice(""); setDiscountedTotal(""); setQuantity(1); setSoldAt(storeDateTimeInputValue());
      setLoading(true);
      setRefreshKey((value) => value + 1);
      formElement.reset();
    }
    setSaving(false);
  }

  async function orderAction(action: "settle_order" | "void_order", orderId: string, method?: PaymentMethod) {
    if (action === "void_order" && confirmVoidId !== orderId) { setConfirmVoidId(orderId); return; }
    setWorkingOrderId(orderId); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-sales", { body: { action, order_id: orderId, payment_method: method } });
    if (error) setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível atualizar a venda.") });
    else {
      setFeedback({ type: "success", message: action === "settle_order" ? "Pagamento marcado como recebido." : "Venda cancelada e itens devolvidos ao estoque." });
      setLoading(true);
      setRefreshKey((value) => value + 1);
    }
    setConfirmVoidId(null); setWorkingOrderId(null);
  }

  async function correctOrder(orderId: string, draft: CorrectionDraft) {
    setWorkingOrderId(orderId); setFeedback(null);
    const { error } = await supabase.functions.invoke("manage-sales", { body: {
      action: "update_order", order_id: orderId, ...draft,
      sold_at: storeInputToIso(draft.sold_at),
    } });
    if (error) {
      setFeedback({ type: "error", message: await functionErrorMessage(error, "Não foi possível corrigir a venda.") });
      setWorkingOrderId(null);
      return false;
    }
    setFeedback({ type: "success", message: "Venda corrigida. O estoque, as finanças e o histórico de alterações foram atualizados." });
    setLoading(true);
    setRefreshKey((value) => value + 1);
    setWorkingOrderId(null);
    return true;
  }

  return <div className="space-y-7">
    <header>
      <p className="text-xs font-extrabold tracking-[0.18em] text-brand">VENDAS</p>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Registrar vendas</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Venda um produto rapidamente ou monte uma venda com vários itens. O estoque é descontado somente após a confirmação.</p>
    </header>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-brand-border bg-white p-2" role="tablist" aria-label="Tipo de venda">
      <ModeButton active={mode === "single"} onClick={() => changeMode("single")} title="Venda única" detail="Um produto" />
      <ModeButton active={mode === "group"} onClick={() => changeMode("group")} title="Venda em grupo" detail="Vários produtos" />
    </div>

    {feedback && <FeedbackMessage feedback={feedback} />}

    <form onSubmit={submitSale} className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-7">
        <p className="text-xs font-extrabold tracking-[0.16em] text-brand">{mode === "single" ? "PRODUTO VENDIDO" : "MONTAR VENDA"}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Pesquisar produto" htmlFor="sale-product-search">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand" />
                <input
                  id="sale-product-search"
                  type="search"
                  value={productSearch}
                  onChange={(event) => { setProductSearch(event.target.value); setSelectedProductId(""); setUnitPrice(""); }}
                  className="form-control pl-11"
                  placeholder="Digite o nome do produto"
                  autoComplete="off"
                />
              </div>
              <span className="mt-2 block text-xs text-muted">{filteredProducts.length} produto(s) encontrado(s). A busca não gera novas requisições.</span>
            </FormField>
          </div>
          <div className="sm:col-span-2"><FormField label="Produto" htmlFor="sale-product"><select id="sale-product" value={selectedProductId} onChange={(event) => selectProduct(event.target.value)} className="form-control"><option value="">{filteredProducts.length ? "Selecione um produto" : "Nenhum produto encontrado"}</option>{filteredProducts.map((product) => <option key={product.id} value={product.id} disabled={product.stock < 1}>{product.name} — {product.stock} disponível(is)</option>)}</select></FormField></div>
          <FormField label="Quantidade" htmlFor="sale-quantity"><input id="sale-quantity" type="number" min={1} max={selectedProduct?.stock || undefined} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="form-control" /></FormField>
          <FormField label="Valor unitário" htmlFor="sale-price"><input id="sale-price" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0,00" className="form-control" /></FormField>
        </div>
        {selectedProduct && <p className="mt-3 text-xs text-muted">Estoque disponível: <strong className="text-foreground">{selectedProduct.stock}</strong></p>}
        {mode === "group" && <button type="button" onClick={addToGroup} className="mt-5 min-h-12 w-full rounded-full border border-brand bg-white px-5 text-xs font-extrabold text-brand">ADICIONAR À VENDA</button>}

        {mode === "group" && <div className="mt-6 border-t border-brand-border pt-5">
          <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Produtos adicionados</h2><span className="text-xs text-muted">{cart.length}/50</span></div>
          {cart.length === 0 ? <p className="mt-4 rounded-2xl bg-brand-soft/40 p-5 text-center text-sm text-muted">A venda ainda não possui produtos.</p> : <div className="mt-4 space-y-3">{cart.map((item) => <div key={item.product_id} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-border p-3"><div><p className="text-sm font-extrabold">{item.product_name}</p><p className="mt-1 text-xs text-muted">{item.quantity} × {money(item.unit_price)}</p></div><div className="text-right"><p className="text-sm font-extrabold text-brand">{money(item.quantity * item.unit_price)}</p><button type="button" onClick={() => setCart((items) => items.filter((current) => current.product_id !== item.product_id))} className="mt-1 text-xs font-bold text-red-600">Remover</button></div></div>)}</div>}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-4"><strong>Total</strong><strong className="text-xl text-brand">{money(saleCartTotal(cart))}</strong></div>
        </div>}
      </section>

      <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-7">
        <p className="text-xs font-extrabold tracking-[0.16em] text-brand">DETALHES DA VENDA</p>
        <div className="mt-5 space-y-4">
          <FormField label="Cliente (opcional)" htmlFor="sale-customer"><input id="sale-customer" name="customer_name" maxLength={160} className="form-control" placeholder="Nome do cliente" /></FormField>
          <FormField label="Valor com desconto (opcional)" htmlFor="sale-discounted-total"><input id="sale-discounted-total" inputMode="decimal" value={discountedTotal} onChange={(event) => setDiscountedTotal(event.target.value)} placeholder={originalSaleTotal > 0 ? originalSaleTotal.toFixed(2).replace(".", ",") : "0,00"} aria-describedby="sale-discount-help" aria-invalid={Boolean(discountValidation.error)} className="form-control" /><span id="sale-discount-help" className={`mt-2 block text-xs leading-5 ${discountValidation.error ? "text-red-600" : "text-muted"}`}>{discountValidation.error ?? "Deixe vazio para manter o valor original da venda."}</span></FormField>
          {originalSaleTotal > 0 && <div className="rounded-2xl bg-brand-soft/55 px-4 py-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">Total original</span><strong>{money(originalSaleTotal)}</strong></div><div className="mt-2 flex items-center justify-between gap-3 border-t border-brand-border/60 pt-2"><span className="font-bold">Total da venda</span><strong className="text-xl text-brand">{money(effectiveSaleTotal)}</strong></div></div>}
          <FormField label="Data e hora" htmlFor="sale-date"><input id="sale-date" type="datetime-local" required value={soldAt} onChange={(event) => setSoldAt(event.target.value)} className="form-control" /></FormField>
          <FormField label="Forma de pagamento" htmlFor="sale-method"><select id="sale-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="form-control">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Situação" htmlFor="sale-status"><select id="sale-status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "paid" | "pending")} className="form-control"><option value="paid">Recebido</option><option value="pending">A receber</option></select></FormField>
          <FormField label="Observação (opcional)" htmlFor="sale-notes"><textarea id="sale-notes" name="notes" rows={3} maxLength={500} className="form-control resize-y" placeholder="Ex.: encomenda para retirada" /></FormField>
        </div>
        <button type="submit" disabled={saving || products.length === 0 || Boolean(discountValidation.error) || (mode === "group" && cart.length === 0)} className="mt-6 min-h-14 w-full rounded-full bg-brand px-6 text-sm font-extrabold text-white shadow-lg shadow-brand/20 disabled:opacity-55">{saving ? "REGISTRANDO..." : mode === "single" ? "CONFIRMAR VENDA" : `CONFIRMAR ${cart.length} PRODUTO(S)`}</button>
        <p className="mt-3 text-center text-xs leading-5 text-muted">Se houver algum erro, toda a operação será cancelada sem alterar o estoque.</p>
      </section>
    </form>

    <section className="rounded-[2rem] border border-brand-border bg-white p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[0.16em] text-brand">HISTÓRICO</p><h2 className="mt-2 font-serif text-3xl">Pedidos registrados</h2></div><div className="flex gap-2 overflow-x-auto">{(["today", "7days", "30days", "all"] as Period[]).map((item) => <button key={item} type="button" onClick={() => setPeriod(item)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${period === item ? "bg-brand text-white" : "border border-brand-border text-brand"}`}>{({ today: "Hoje", "7days": "7 dias", "30days": "30 dias", all: "Tudo" } as Record<Period, string>)[item]}</button>)}</div></div>
      <div className="mt-5 grid grid-cols-3 gap-2"><Stat label="Pedidos" value={String(activeOrders.length)} /><Stat label="Total" value={money(periodTotal)} /><Stat label="A receber" value={money(pendingTotal)} /></div>
      {loading ? <p className="py-10 text-center text-sm text-muted">Carregando vendas...</p> : filteredOrders.length === 0 ? <p className="py-10 text-center text-sm text-muted">Nenhuma venda encontrada neste período.</p> : <div className="mt-6 space-y-4">{filteredOrders.map((order) => <OrderCard key={order.order_id} order={order} corrections={correctionsByOrder.get(order.order_id) ?? []} busy={workingOrderId === order.order_id} confirmVoid={confirmVoidId === order.order_id} onAction={orderAction} onCorrect={correctOrder} />)}</div>}
    </section>
  </div>;
}

function ModeButton({ active, onClick, title, detail }: { active: boolean; onClick: () => void; title: string; detail: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-16 rounded-xl px-3 text-center ${active ? "bg-brand text-white" : "text-brand"}`}><strong className="block text-sm">{title}</strong><span className={`mt-1 block text-[0.65rem] ${active ? "text-white/75" : "text-muted"}`}>{detail}</span></button>;
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-brand-soft/55 px-2 py-4 text-center"><strong className="block text-sm text-brand sm:text-lg">{value}</strong><span className="mt-1 block text-[0.6rem] font-bold uppercase text-muted">{label}</span></div>;
}

function OrderCard({ order, corrections, busy, confirmVoid, onAction, onCorrect }: { order: ReturnType<typeof groupSaleRows>[number]; corrections: SaleCorrection[]; busy: boolean; confirmVoid: boolean; onAction: (action: "settle_order" | "void_order", orderId: string, method?: PaymentMethod) => void; onCorrect: (orderId: string, draft: CorrectionDraft) => Promise<boolean> }) {
  const [method, setMethod] = useState<PaymentMethod>(order.payment_method);
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState(() => order.rows.map((row) => ({ sale_id: row.id, product_id: row.product_id, product_name: row.product_name, quantity: row.quantity, unit_price: String(row.unit_price).replace(".", ",") })));
  const [editCustomer, setEditCustomer] = useState(order.customer_name ?? "");
  const [editMethod, setEditMethod] = useState<PaymentMethod>(order.payment_method);
  const [editStatus, setEditStatus] = useState<"paid" | "pending">(order.payment_status);
  const [editSoldAt, setEditSoldAt] = useState(() => storeDateTimeInputValue(order.sold_at));
  const [editNotes, setEditNotes] = useState(order.rows[0]?.notes ?? "");
  const [editReason, setEditReason] = useState("");
  const [editFinalTotal, setEditFinalTotal] = useState("");
  const [editError, setEditError] = useState("");
  const editBaseTotal = editItems.reduce((sum, item) => sum + item.quantity * parseBrazilianCurrency(item.unit_price), 0);
  const editDiscount = validateDiscountedTotal(editBaseTotal, editFinalTotal);

  function startEditing() {
    setEditItems(order.rows.map((row) => ({ sale_id: row.id, product_id: row.product_id, product_name: row.product_name, quantity: row.quantity, unit_price: String(row.unit_price).replace(".", ",") })));
    setEditCustomer(order.customer_name ?? ""); setEditMethod(order.payment_method); setEditStatus(order.payment_status);
    setEditSoldAt(storeDateTimeInputValue(order.sold_at)); setEditNotes(order.rows[0]?.notes ?? "");
    setEditReason(""); setEditFinalTotal(""); setEditError(""); setEditing(true);
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editDiscount.error) { setEditError(editDiscount.error); return; }
    if (editReason.trim().length < 3) { setEditError("Informe o motivo da correção."); return; }
    const items = editItems.map((item) => ({ ...item, unit_price: parseBrazilianCurrency(item.unit_price) }));
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_price) || item.unit_price <= 0)) { setEditError("Revise as quantidades e os valores dos produtos."); return; }
    if (!Number.isFinite(new Date(editSoldAt).getTime())) { setEditError("Informe uma data válida para a venda."); return; }
    setEditError("");
    const saved = await onCorrect(order.order_id, {
      items: items.map(({ sale_id, product_id, quantity, unit_price }) => ({ sale_id, product_id, quantity, unit_price })),
      customer_name: editCustomer.trim(), payment_method: editMethod, payment_status: editStatus,
      sold_at: editSoldAt, notes: editNotes.trim(), reason: editReason.trim(), final_total: editDiscount.value,
    });
    if (saved) setEditing(false);
  }

  return <article className={`rounded-2xl border p-4 ${order.voided ? "border-slate-200 bg-slate-50 opacity-65" : "border-brand-border"}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold">{order.customer_name || "Venda sem nome"}</p><p className="mt-1 text-xs text-muted">{formatStoreDateTime(order.sold_at)} · {order.units} unidade(s)</p></div><div className="text-right"><p className="font-extrabold text-brand">{money(order.total)}</p><p className={`mt-1 text-[0.62rem] font-extrabold uppercase ${order.voided ? "text-slate-500" : order.payment_status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>{order.voided ? "Cancelada" : order.payment_status === "paid" ? `Recebido · ${paymentLabels[order.payment_method]}` : "A receber"}</p></div></div>
    <ul className="mt-3 space-y-1 border-t border-brand-border/60 pt-3">{order.rows.map((row) => <li key={row.id} className="flex justify-between gap-3 text-xs"><span>{row.quantity} × {row.product_name}</span><span className="font-bold">{money(row.total_amount)}</span></li>)}</ul>
    {corrections.length > 0 && <details className="mt-3 rounded-xl bg-amber-50 px-3 py-2"><summary className="cursor-pointer text-xs font-bold text-amber-800">{corrections.length} correção(ões) registrada(s)</summary><div className="mt-2 space-y-2">{corrections.map((correction) => <div key={correction.id} className="border-t border-amber-200 pt-2 text-xs leading-5 text-amber-900"><p><strong>{money(correction.previous_total)}</strong> → <strong>{money(correction.corrected_total)}</strong></p><p>{formatStoreDateTime(correction.corrected_at)} · {correction.reason}</p></div>)}</div></details>}
    {!order.voided && !editing && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-border/60 pt-3">{order.payment_status === "pending" && <><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="min-h-10 rounded-full border border-brand-border bg-white px-3 text-xs">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" disabled={busy} onClick={() => onAction("settle_order", order.order_id, method)} className="min-h-10 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-60">Marcar recebido</button></>}<button type="button" disabled={busy} onClick={startEditing} className="min-h-10 rounded-full border border-brand px-4 text-xs font-bold text-brand disabled:opacity-60">Editar venda</button><button type="button" disabled={busy} onClick={() => onAction("void_order", order.order_id)} className="ml-auto min-h-10 rounded-full border border-red-200 px-4 text-xs font-bold text-red-600 disabled:opacity-60">{busy ? "Processando..." : confirmVoid ? "Confirmar cancelamento" : "Cancelar venda"}</button></div>}
    {editing && <form onSubmit={submitCorrection} className="mt-4 space-y-4 border-t border-brand-border pt-4">
      <div><p className="text-xs font-extrabold tracking-wider text-brand">CORRIGIR VENDA</p><p className="mt-1 text-xs leading-5 text-muted">O sistema ajustará somente a diferença no estoque e guardará os valores anteriores.</p></div>
      <div className="space-y-3">{editItems.map((item, index) => <div key={item.sale_id} className="rounded-2xl bg-brand-soft/45 p-3"><p className="text-sm font-bold">{item.product_name}</p><div className="mt-3 grid grid-cols-2 gap-3"><FormField label="Quantidade" htmlFor={`edit-quantity-${item.sale_id}`}><input id={`edit-quantity-${item.sale_id}`} type="number" min={1} required value={item.quantity} onChange={(event) => setEditItems((items) => items.map((current, currentIndex) => currentIndex === index ? { ...current, quantity: Number(event.target.value) } : current))} className="form-control" /></FormField><FormField label="Valor unitário" htmlFor={`edit-price-${item.sale_id}`}><input id={`edit-price-${item.sale_id}`} inputMode="decimal" required value={item.unit_price} onChange={(event) => setEditItems((items) => items.map((current, currentIndex) => currentIndex === index ? { ...current, unit_price: event.target.value } : current))} className="form-control" /></FormField></div></div>)}</div>
      <FormField label="Valor com desconto (opcional)" htmlFor={`edit-final-${order.order_id}`}><input id={`edit-final-${order.order_id}`} inputMode="decimal" value={editFinalTotal} onChange={(event) => setEditFinalTotal(event.target.value)} placeholder={Number.isFinite(editBaseTotal) ? editBaseTotal.toFixed(2).replace(".", ",") : "0,00"} aria-invalid={Boolean(editDiscount.error)} className="form-control" /><span className={`mt-2 block text-xs ${editDiscount.error ? "text-red-600" : "text-muted"}`}>{editDiscount.error ?? `Novo total: ${money(editDiscount.value ?? editBaseTotal)}`}</span></FormField>
      <FormField label="Cliente (opcional)" htmlFor={`edit-customer-${order.order_id}`}><input id={`edit-customer-${order.order_id}`} maxLength={160} value={editCustomer} onChange={(event) => setEditCustomer(event.target.value)} className="form-control" /></FormField>
      <FormField label="Data e hora" htmlFor={`edit-date-${order.order_id}`}><input id={`edit-date-${order.order_id}`} type="datetime-local" required value={editSoldAt} onChange={(event) => setEditSoldAt(event.target.value)} className="form-control" /></FormField>
      <div className="grid grid-cols-2 gap-3"><FormField label="Pagamento" htmlFor={`edit-method-${order.order_id}`}><select id={`edit-method-${order.order_id}`} value={editMethod} onChange={(event) => setEditMethod(event.target.value as PaymentMethod)} className="form-control">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField><FormField label="Situação" htmlFor={`edit-status-${order.order_id}`}><select id={`edit-status-${order.order_id}`} value={editStatus} onChange={(event) => setEditStatus(event.target.value as "paid" | "pending")} className="form-control"><option value="paid">Recebido</option><option value="pending">A receber</option></select></FormField></div>
      <FormField label="Observação (opcional)" htmlFor={`edit-notes-${order.order_id}`}><textarea id={`edit-notes-${order.order_id}`} rows={2} maxLength={500} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} className="form-control resize-y" /></FormField>
      <FormField label="Motivo da correção" htmlFor={`edit-reason-${order.order_id}`}><input id={`edit-reason-${order.order_id}`} required minLength={3} maxLength={240} value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Ex.: valor digitado incorretamente" className="form-control" /></FormField>
      {editError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{editError}</p>}
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => setEditing(false)} className="min-h-11 flex-1 rounded-full border border-brand-border px-4 text-xs font-bold text-muted">VOLTAR</button><button type="submit" disabled={busy || Boolean(editDiscount.error) || editReason.trim().length < 3} className="min-h-11 flex-1 rounded-full bg-brand px-4 text-xs font-extrabold text-white disabled:opacity-55">{busy ? "SALVANDO..." : "SALVAR CORREÇÃO"}</button></div>
    </form>}
  </article>;
}
