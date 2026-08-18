import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { applyFinalSaleTotal } from "../_shared/sale-discount.ts";

const PAYMENT_METHODS = new Set(["credit_card", "debit_card", "pix", "cash"]);
const PAYMENT_STATUSES = new Set(["paid", "pending"]);

type SaleItem = { product_id: string; quantity: number; unit_price: number };
type SaleCorrectionItem = SaleItem & { sale_id: string };

function saleItems(value: unknown): SaleItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const items = value.map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      product_id: String(raw.product_id ?? ""),
      quantity: Number(raw.quantity),
      unit_price: Number(raw.unit_price),
    };
  });
  if (items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_price) || item.unit_price <= 0)) return null;
  if (new Set(items.map((item) => item.product_id)).size !== items.length) return null;
  return items;
}

function correctionItems(value: unknown): SaleCorrectionItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const items = value.map((item) => {
    const raw = item as Record<string, unknown>;
    return {
      sale_id: String(raw.sale_id ?? ""),
      product_id: String(raw.product_id ?? ""),
      quantity: Number(raw.quantity),
      unit_price: Number(raw.unit_price),
    };
  });
  if (items.some((item) => !item.sale_id || !item.product_id || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_price) || item.unit_price <= 0)) return null;
  if (new Set(items.map((item) => item.sale_id)).size !== items.length) return null;
  return items;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    await assertInventoryAccess(context);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "list");

    if (action === "list") {
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      let query = context.adminClient
        .from("sales")
        .select("id, order_id, product_id, product_name, quantity, unit_price, unit_cost, total_amount, total_cost, gross_profit, customer_name, payment_method, payment_status, payment_received_at, sold_at, notes, voided_at, created_at, updated_at")
        .order("sold_at", { ascending: false })
        .limit(1000);
      if (from) query = query.gte("sold_at", from);
      if (to) query = query.lt("sold_at", to);
      const { data, error } = await query;
      if (error) throw new Error(`Não foi possível carregar as vendas: ${error.message}`);
      const { data: revisions, error: revisionError } = await context.adminClient
        .from("sale_order_revisions")
        .select("id, order_id, previous_total, corrected_total, reason, corrected_at")
        .order("corrected_at", { ascending: false })
        .limit(1000);
      if (revisionError) throw new Error(`Não foi possível carregar as correções: ${revisionError.message}`);
      return json(request, { ok: true, sales: data ?? [], corrections: revisions ?? [] });
    }

    if (action === "create") {
      const productId = String(body.product_id ?? "");
      const quantity = Number(body.quantity);
      const unitPrice = Number(body.unit_price);
      const paymentMethod = String(body.payment_method ?? "");
      const paymentStatus = String(body.payment_status ?? "");
      const soldAt = String(body.sold_at ?? "");
      const notes = String(body.notes ?? "").trim();
      const customerName = String(body.customer_name ?? "").trim();
      if (!productId || !Number.isInteger(quantity) || quantity <= 0) return json(request, { error: "Informe o produto e uma quantidade válida." }, 400);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return json(request, { error: "Informe um valor maior que zero." }, 400);
      if (!PAYMENT_METHODS.has(paymentMethod)) return json(request, { error: "Forma de pagamento inválida." }, 400);
      if (!PAYMENT_STATUSES.has(paymentStatus)) return json(request, { error: "Situação do pagamento inválida." }, 400);
      if (notes.length > 500) return json(request, { error: "A observação deve ter até 500 caracteres." }, 400);
      if (customerName.length > 160) return json(request, { error: "O nome do cliente deve ter até 160 caracteres." }, 400);

      const adjusted = applyFinalSaleTotal([{ product_id: productId, quantity, unit_price: unitPrice }], body.final_total);
      const { data, error } = await context.adminClient.rpc("register_sale", {
        p_product_id: productId,
        p_quantity: quantity,
        p_unit_price: adjusted.items[0].unit_price,
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_sold_at: soldAt || new Date().toISOString(),
        p_notes: notes,
        p_created_by: context.user.id,
      });
      if (error) throw new Error(error.message);
      if (customerName) {
        const saleId = Array.isArray(data) ? data[0]?.id : (data as { id?: string } | null)?.id;
        if (saleId) await context.adminClient.from("sales").update({ customer_name: customerName }).eq("id", saleId);
      }
      return json(request, { ok: true, sale: data, original_total: adjusted.originalTotal, final_total: adjusted.finalTotal }, 201);
    }

    if (action === "create_batch") {
      const items = saleItems(body.items);
      const paymentMethod = String(body.payment_method ?? "");
      const paymentStatus = String(body.payment_status ?? "");
      const soldAt = String(body.sold_at ?? "");
      const notes = String(body.notes ?? "").trim();
      const customerName = String(body.customer_name ?? "").trim();
      if (!items) return json(request, { error: "Adicione entre 1 e 50 produtos válidos, sem repetições." }, 400);
      if (!PAYMENT_METHODS.has(paymentMethod)) return json(request, { error: "Forma de pagamento inválida." }, 400);
      if (!PAYMENT_STATUSES.has(paymentStatus)) return json(request, { error: "Situação do pagamento inválida." }, 400);
      if (notes.length > 500) return json(request, { error: "A observação deve ter até 500 caracteres." }, 400);
      if (customerName.length > 160) return json(request, { error: "O nome do cliente deve ter até 160 caracteres." }, 400);

      const adjusted = applyFinalSaleTotal(items, body.final_total);
      const { data, error } = await context.adminClient.rpc("register_sales_batch", {
        p_items: adjusted.items,
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_sold_at: soldAt || new Date().toISOString(),
        p_notes: notes,
        p_customer_name: customerName,
        p_created_by: context.user.id,
      });
      if (error) throw new Error(error.message);
      return json(request, { ok: true, sales: data, original_total: adjusted.originalTotal, final_total: adjusted.finalTotal }, 201);
    }

    if (action === "update_order") {
      const orderId = String(body.order_id ?? "");
      const items = correctionItems(body.items);
      const paymentMethod = String(body.payment_method ?? "");
      const paymentStatus = String(body.payment_status ?? "");
      const soldAt = String(body.sold_at ?? "");
      const notes = String(body.notes ?? "").trim();
      const customerName = String(body.customer_name ?? "").trim();
      const reason = String(body.reason ?? "").trim();
      if (!orderId || !items) return json(request, { error: "Informe todos os produtos da venda com quantidades e valores válidos." }, 400);
      if (!PAYMENT_METHODS.has(paymentMethod)) return json(request, { error: "Forma de pagamento inválida." }, 400);
      if (!PAYMENT_STATUSES.has(paymentStatus)) return json(request, { error: "Situação do pagamento inválida." }, 400);
      if (!Number.isFinite(Date.parse(soldAt))) return json(request, { error: "Data da venda inválida." }, 400);
      if (notes.length > 500) return json(request, { error: "A observação deve ter até 500 caracteres." }, 400);
      if (customerName.length > 160) return json(request, { error: "O nome do cliente deve ter até 160 caracteres." }, 400);
      if (reason.length < 3 || reason.length > 240) return json(request, { error: "Informe o motivo da correção com 3 a 240 caracteres." }, 400);

      const adjusted = applyFinalSaleTotal(items, body.final_total);
      const { data, error } = await context.adminClient.rpc("update_sale_order", {
        p_order_id: orderId,
        p_items: adjusted.items.map(({ sale_id, quantity, unit_price }) => ({ sale_id, quantity, unit_price })),
        p_customer_name: customerName,
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_sold_at: new Date(soldAt).toISOString(),
        p_notes: notes,
        p_reason: reason,
        p_corrected_by: context.user.id,
      });
      if (error) throw new Error(error.message);
      return json(request, { ok: true, sales: data, original_total: adjusted.originalTotal, final_total: adjusted.finalTotal });
    }

    if (action === "settle") {
      const saleId = String(body.sale_id ?? "");
      const paymentMethod = String(body.payment_method ?? "");
      if (!saleId || !PAYMENT_METHODS.has(paymentMethod)) return json(request, { error: "Venda ou forma de pagamento inválida." }, 400);
      const { data, error } = await context.adminClient.rpc("settle_sale", { p_sale_id: saleId, p_payment_method: paymentMethod });
      if (error) throw new Error(error.message);
      return json(request, { ok: true, sale: data });
    }

    if (action === "void") {
      const saleId = String(body.sale_id ?? "");
      if (!saleId) return json(request, { error: "Venda não informada." }, 400);
      const { data, error } = await context.adminClient.rpc("void_sale", { p_sale_id: saleId });
      if (error) throw new Error(error.message);
      return json(request, { ok: true, sale: data });
    }

    if (action === "settle_order") {
      const orderId = String(body.order_id ?? "");
      const paymentMethod = String(body.payment_method ?? "");
      if (!orderId || !PAYMENT_METHODS.has(paymentMethod)) return json(request, { error: "Venda ou forma de pagamento inválida." }, 400);
      const { data, error } = await context.adminClient.rpc("settle_sale_order", { p_order_id: orderId, p_payment_method: paymentMethod });
      if (error) throw new Error(error.message);
      return json(request, { ok: true, sales: data });
    }

    if (action === "void_order") {
      const orderId = String(body.order_id ?? "");
      if (!orderId) return json(request, { error: "Venda não informada." }, 400);
      const { data, error } = await context.adminClient.rpc("void_sale_order", { p_order_id: orderId });
      if (error) throw new Error(error.message);
      return json(request, { ok: true, sales: data });
    }

    return json(request, { error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível processar o fluxo de caixa.";
    return json(request, { error: message }, 401);
  }
});
