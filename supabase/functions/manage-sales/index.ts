import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";

const PAYMENT_METHODS = new Set(["credit_card", "debit_card", "pix", "cash"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    assertInventoryAccess(context);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "list");

    if (action === "list") {
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      let query = context.adminClient
        .from("sales")
        .select("id, product_id, product_name, quantity, unit_price, unit_cost, total_amount, total_cost, gross_profit, customer_name, payment_method, payment_status, payment_received_at, sold_at, notes, voided_at, created_at")
        .order("sold_at", { ascending: false })
        .limit(1000);
      if (from) query = query.gte("sold_at", from);
      if (to) query = query.lt("sold_at", to);
      const { data, error } = await query;
      if (error) throw new Error(`Não foi possível carregar as vendas: ${error.message}`);
      return json(request, { ok: true, sales: data ?? [] });
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
      if (!["paid", "pending"].includes(paymentStatus)) return json(request, { error: "Situação do pagamento inválida." }, 400);
      if (notes.length > 500) return json(request, { error: "A observação deve ter até 500 caracteres." }, 400);
      if (customerName.length > 160) return json(request, { error: "O nome do cliente deve ter até 160 caracteres." }, 400);

      const { data, error } = await context.adminClient.rpc("register_sale", {
        p_product_id: productId,
        p_quantity: quantity,
        p_unit_price: unitPrice,
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
      return json(request, { ok: true, sale: data }, 201);
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

    return json(request, { error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível processar o fluxo de caixa.";
    return json(request, { error: message }, 401);
  }
});
