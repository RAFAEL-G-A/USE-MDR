import {
  assertInventoryAccess,
  authenticateAdmin,
  corsHeaders,
  json,
} from "../_shared/admin-auth.ts";

type Period = "today" | "week" | "month";

const EXPENSE_CATEGORIES = new Set(["suppliers", "packaging", "shipping", "marketing", "utilities", "other"]);
const EXPENSE_STATUSES = new Set(["paid", "pending", "void"]);

function dateInRecife(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function periodRange(period: Period, anchorValue?: string) {
  const anchor = parseDate(anchorValue || dateInRecife());
  let start = new Date(anchor);
  let end = new Date(anchor);

  if (period === "week") {
    const day = anchor.getUTCDay() || 7;
    start = addDays(anchor, 1 - day);
    end = addDays(start, 6);
  } else if (period === "month") {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
  }

  const duration = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(duration - 1));

  return {
    start: isoDate(start),
    end: isoDate(end),
    previousStart: isoDate(previousStart),
    previousEnd: isoDate(previousEnd),
  };
}

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Método não permitido." }, 405);

  try {
    const context = await authenticateAdmin(request);
    assertInventoryAccess(context);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "dashboard");

    if (action === "dashboard") {
      const period = String(body.period ?? "month") as Period;
      if (!["today", "week", "month"].includes(period)) return json(request, { error: "Período inválido." }, 400);
      const anchor = String(body.anchor ?? "");
      if (anchor && !validIsoDate(anchor)) return json(request, { error: "Data de referência inválida." }, 400);
      const range = periodRange(period, anchor);
      const [current, previous, series, expenses] = await Promise.all([
        context.adminClient.rpc("get_financial_metrics", { p_period_start: range.start, p_period_end: range.end }),
        context.adminClient.rpc("get_financial_metrics", { p_period_start: range.previousStart, p_period_end: range.previousEnd }),
        context.adminClient.rpc("get_financial_series", { p_period_start: range.start, p_period_end: range.end }),
        context.adminClient.from("expenses").select("id, description, amount, category, occurred_at, notes, status, paid_at, created_at").neq("status", "void").order("occurred_at", { ascending: false }).limit(200),
      ]);
      const failure = [current.error, previous.error, series.error, expenses.error].find(Boolean);
      if (failure) throw new Error(`Não foi possível carregar as finanças: ${failure.message}`);
      return json(request, {
        ok: true,
        period,
        range,
        metrics: current.data,
        previous_metrics: previous.data,
        series: series.data,
        expenses: expenses.data ?? [],
      });
    }

    if (action === "create_expense" || action === "update_expense") {
      const description = String(body.description ?? "").trim();
      const amount = Number(body.amount);
      const category = String(body.category ?? "");
      const status = String(body.status ?? "paid");
      const occurredAt = String(body.occurred_at ?? "");
      const notes = String(body.notes ?? "").trim();
      if (!description || description.length > 160) return json(request, { error: "Informe uma descrição com até 160 caracteres." }, 400);
      if (!Number.isFinite(amount) || amount <= 0) return json(request, { error: "Informe um valor de despesa válido." }, 400);
      if (!EXPENSE_CATEGORIES.has(category)) return json(request, { error: "Categoria de despesa inválida." }, 400);
      if (!EXPENSE_STATUSES.has(status) || status === "void") return json(request, { error: "Situação de despesa inválida." }, 400);
      if (notes.length > 500) return json(request, { error: "A observação deve ter até 500 caracteres." }, 400);
      const occurredDate = occurredAt ? new Date(occurredAt) : new Date();
      if (!Number.isFinite(occurredDate.getTime())) return json(request, { error: "Data da despesa inválida." }, 400);
      const expense = {
        description,
        amount,
        category,
        status,
        occurred_at: occurredDate.toISOString(),
        paid_at: status === "paid" ? occurredDate.toISOString() : null,
        notes: notes || null,
        created_by: context.user.id,
        updated_at: new Date().toISOString(),
      };
      const id = String(body.id ?? "");
      const query = action === "create_expense"
        ? context.adminClient.from("expenses").insert(expense)
        : context.adminClient.from("expenses").update(expense).eq("id", id);
      if (action === "update_expense" && !id) return json(request, { error: "Despesa não informada." }, 400);
      const { data, error } = await query.select("id, description, amount, category, occurred_at, notes, status, paid_at, created_at").single();
      if (error) throw new Error(`Não foi possível salvar a despesa: ${error.message}`);
      return json(request, { ok: true, expense: data }, action === "create_expense" ? 201 : 200);
    }

    if (action === "void_expense") {
      const id = String(body.id ?? "");
      if (!id) return json(request, { error: "Despesa não informada." }, 400);
      const { error } = await context.adminClient.from("expenses").update({ status: "void", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(`Não foi possível excluir a despesa: ${error.message}`);
      return json(request, { ok: true, id });
    }

    if (action === "get_settings") {
      const { data, error } = await context.adminClient.from("financial_report_settings").select("recipient_email, daily_enabled, weekly_enabled, monthly_enabled, timezone, updated_at").eq("id", 1).single();
      if (error) throw new Error(`Não foi possível carregar as configurações: ${error.message}`);
      return json(request, { ok: true, settings: data });
    }

    if (action === "update_settings") {
      const recipientEmail = String(body.recipient_email ?? "").trim().toLowerCase();
      if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return json(request, { error: "E-mail destinatário inválido." }, 400);
      const { data, error } = await context.adminClient.from("financial_report_settings").update({
        recipient_email: recipientEmail || null,
        daily_enabled: body.daily_enabled === true,
        weekly_enabled: body.weekly_enabled === true,
        monthly_enabled: body.monthly_enabled === true,
        updated_by: context.user.id,
        updated_at: new Date().toISOString(),
      }).eq("id", 1).select("recipient_email, daily_enabled, weekly_enabled, monthly_enabled, timezone, updated_at").single();
      if (error) throw new Error(`Não foi possível salvar as configurações: ${error.message}`);
      return json(request, { ok: true, settings: data });
    }

    if (action === "create_closure") {
      const periodType = String(body.period_type ?? "");
      const periodStart = String(body.period_start ?? "");
      const periodEnd = String(body.period_end ?? "");
      if (!["daily", "weekly", "monthly"].includes(periodType) || !validIsoDate(periodStart) || !validIsoDate(periodEnd)) {
        return json(request, { error: "Dados do fechamento inválidos." }, 400);
      }
      const { data, error } = await context.adminClient.rpc("create_financial_closure", {
        p_period_type: periodType,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_generated_by: context.user.id,
      });
      if (error) throw new Error(`Não foi possível gerar o fechamento: ${error.message}`);
      return json(request, { ok: true, closure: data });
    }

    return json(request, { error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível processar as finanças.";
    return json(request, { error: message }, 401);
  }
});
