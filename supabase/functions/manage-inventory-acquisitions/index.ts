import {
  assertAdminSection,
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";
import { writeAdminAudit } from "../_shared/admin-audit.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    assertAdminSection(context, "acquisitions");
    await assertInventoryAccess(context);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "list") {
      const [{ data: products, error: productsError }, { data: entries, error: entriesError }] = await Promise.all([
        context.adminClient.from("products").select("id, name, price, stock").order("name"),
        context.adminClient.from("inventory_acquisitions")
          .select("id, product_id, movement_type, quantity, unit_cost, previous_stock, new_stock, previous_average_cost, new_average_cost, sale_price_before, sale_price_after, supplier, document_reference, notes, acquired_at, created_by")
          .order("acquired_at", { ascending: false }).limit(100),
      ]);
      if (productsError || entriesError) throw productsError ?? entriesError;
      const { data: costs, error: costsError } = await context.adminClient.from("product_costs").select("product_id, cost_price");
      if (costsError) throw costsError;
      const costByProduct = new Map((costs ?? []).map((item) => [String(item.product_id), Number(item.cost_price)]));
      const nameByProduct = new Map((products ?? []).map((item) => [String(item.id), String(item.name)]));
      return json(request, {
        ok: true,
        products: (products ?? []).map((item) => ({ ...item, average_cost: costByProduct.get(String(item.id)) ?? 0 })),
        acquisitions: (entries ?? []).map((item) => ({ ...item, product_name: nameByProduct.get(String(item.product_id)) ?? "Produto removido" })),
      });
    }

    if (action !== "create") return json(request, { error: "Ação inválida." }, 400);
    const productId = String(body.product_id ?? "");
    const quantity = Number(body.quantity);
    const unitCost = Number(body.unit_cost);
    const salePrice = body.sale_price === null || body.sale_price === undefined || body.sale_price === "" ? null : Number(body.sale_price);
    const acquiredAt = String(body.acquired_at ?? "");
    if (!productId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0 || (salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0))) {
      return json(request, { error: "Informe produto, quantidade e custo válidos." }, 400);
    }
    const { data, error } = await context.adminClient.rpc("register_inventory_acquisition", {
      p_product_id: productId,
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_sale_price: salePrice,
      p_supplier: String(body.supplier ?? "").trim() || null,
      p_document_reference: String(body.document_reference ?? "").trim() || null,
      p_notes: String(body.notes ?? "").trim() || null,
      p_acquired_at: acquiredAt || null,
      p_created_by: context.user.id,
    });
    if (error) throw error;
    await writeAdminAudit(request, context, {
      action: "inventory_acquisition",
      resourceType: "product",
      resourceId: productId,
      result: "success",
      metadata: { quantity, unit_cost: unitCost, new_average_cost: Number(data?.new_average_cost ?? 0) },
    });
    await writeAdminAudit(request, context, {
      action: "stock_change",
      resourceType: "product",
      resourceId: productId,
      result: "success",
      metadata: { operation: "acquisition", quantity, new_stock: Number(data?.new_stock ?? 0) },
    });
    return json(request, { ok: true, acquisition: data }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a aquisição.";
    return json(request, { error: message }, 401);
  }
});
